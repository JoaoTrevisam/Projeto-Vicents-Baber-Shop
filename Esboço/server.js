// server.js
// Node 18+ recommended
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // coloque index.html, styles.css, script.js dentro de ./public

// Simples "banco" em memória para demo
const bookings = [];

// Horário de atendimento do salão (exemplo)
const OPEN_HOUR = 9;
const CLOSE_HOUR = 18;

// Endpoint para listar agendamentos (simples)
app.get('/bookings', (req,res) => {
  res.json(bookings.sort((a,b)=> new Date(a.start)-new Date(b.start)));
});

// Endpoint que calcula horários disponíveis para uma data (simples)
app.get('/available', async (req,res) => {
  const date = req.query.date; // formato YYYY-MM-DD
  const minutes = parseInt(req.query.minutes || '30', 10);

  // 1) gerar slots na faixa de atendimento
  const slots = [];
  const base = new Date(date + 'T00:00:00');
  for (let h = OPEN_HOUR; h < CLOSE_HOUR; h++) {
    for (let m = 0; m < 60; m += 15) { // opções a cada 15min
      const s = new Date(base);
      s.setHours(h, m, 0, 0);
      slots.push(s);
    }
  }

  // 2) remover slots que conflitam com agendamentos já existentes
  const busyRanges = bookings.map(b => ({
    start: new Date(b.start),
    end: new Date(new Date(b.start).getTime() + b.service.minutes*60000)
  }));

  // 3) (Opcional) check com Google Calendar: função mock (substituir por integração real)
  const googleBusy = await checkGoogleBusy(date);

  const available = slots.filter(slot => {
    // ignorar slots fora do dia requestado (safety)
    if (slot.toISOString().slice(0,10) !== date) return false;

    // montar end do possível agendamento
    const end = new Date(slot.getTime() + minutes*60000);

    // se conflita com bookings
    for (const br of busyRanges) {
      if (!(end <= br.start || slot >= br.end)) return false;
    }

    // se conflita com google busy
    for (const gb of googleBusy) {
      if (!(end <= new Date(gb.start) || slot >= new Date(gb.end))) return false;
    }

    // horário no passado? bloquear
    if (slot.getTime() < Date.now()) return false;

    return true;
  });

  res.json(available.map(d=>d.toISOString()));
});

// Endpoint para criar agendamento
app.post('/book', async (req,res) => {
  try {
    const { client, phone, service, start } = req.body;
    if (!client || !phone || !service || !start) return res.status(400).json({error:'dados incompletos'});

    // Verificação simples de conflito
    const requestedStart = new Date(start);
    const requestedEnd = new Date(requestedStart.getTime() + service.minutes*60000);
    for (const b of bookings) {
      const bs = new Date(b.start);
      const be = new Date(bs.getTime() + b.service.minutes*60000);
      if (!(requestedEnd <= bs || requestedStart >= be)) {
        return res.json({ ok:false, error:'Horário já reservado' });
      }
    }

    const booking = { id: Date.now().toString(), client, phone, service, start: requestedStart.toISOString() };
    bookings.push(booking);

    // Agendar notificações (24h e 1h antes) — demo com setTimeout
    scheduleNotifications(booking);

    // (Opcional) criar evento no Google Calendar — função placeholder
    // await createGoogleEvent(booking);

    res.json({ ok:true, booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok:false, error: 'erro interno' });
  }
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, ()=> console.log('Server running on port', PORT));

/* ------------------------
  Funções auxiliares
   - checkGoogleBusy(date): mock
   - scheduleNotifications(booking): agenda envio via função sendWhatsApp (exemplo Twilio)
-------------------------*/

async function checkGoogleBusy(date) {
  // Aqui em produção faça a chamada Google Calendar Freebusy API para obter intervalos ocupados.
  // Para demo, retornamos um array vazio.
  return [];
}

function scheduleNotifications(booking) {
  const start = new Date(booking.start);
  const phone = booking.phone;
  const client = booking.client;

  const notifTimes = [
    { when: new Date(start.getTime() - 24*3600*1000), label: '24h' },
    { when: new Date(start.getTime() - 1*3600*1000), label: '1h' }
  ];

  notifTimes.forEach(n => {
    const diff = n.when.getTime() - Date.now();
    if (diff <= 0) {
      console.log(`Aviso ${n.label} para ${booking.client} (horário já passou ou é imediato)`);
      return;
    }
    // ATENÇÃO: setTimeout não persiste caso o processo seja reiniciado. Para produção,
    // use um agendador persistente (cron + DB, job queue com Redis/Bull, ou serviços gerenciados).
    setTimeout(async () => {
      console.log(`Enviando notificação ${n.label} para ${client} (${phone}) - agendamento ${booking.id}`);
      // Chamar função de envio real
      try { await sendWhatsAppMessage(phone, `Lembrete: seu horário ${booking.service.name} é em ${start.toLocaleString()} (avisado ${n.label} antes).`); }
      catch(e){ console.error('erro ao enviar whatsapp', e); }
    }, diff);
  });
}

/* Exemplo de integração Twilio (comentei para não quebrar se não tiver config)
   Para usar:
   1) npm i twilio
   2) definir TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
   3) descomentar
*/
// import Twilio from 'twilio';
// const twClient = process.env.TWILIO_ACCOUNT_SID ? Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

async function sendWhatsAppMessage(to, text) {
  // Para demonstração, apenas imprime
  console.log(`[DEMO] enviar WhatsApp para ${to}: ${text}`);

  // === Exemplo real com Twilio ===
  /*
  if (!twClient) throw new Error('Twilio não configurado');
  const from = process.env.TWILIO_WHATSAPP_FROM; // ex: 'whatsapp:+1415XXXXXXX'
  const toWhats = 'whatsapp:' + to;
  const msg = await twClient.messages.create({ body: text, from, to: toWhats });
  return msg;
  */
}
