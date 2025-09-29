const checkSlotsBtn = document.getElementById('checkSlots');
const slotsDiv = document.getElementById('slots');
const bookingsUl = document.getElementById('bookings');
const msgDiv = document.getElementById('message');

async function loadBookings() {
  const res = await fetch('/bookings');
  const arr = await res.json();
  bookingsUl.innerHTML = arr.map(b => {
    const d = new Date(b.start);
    return `<li><strong>${b.client}</strong> — ${b.service} — ${d.toLocaleString()}</li>`;
  }).join('') || '<li>(nenhum)</li>';
}

checkSlotsBtn.addEventListener('click', async () => {
  slotsDiv.innerHTML = 'Carregando...';
  const date = document.getElementById('dateInput').value;
  const select = document.getElementById('serviceSelect');
  const service = JSON.parse(select.value);
  if (!date) { slotsDiv.innerHTML = 'Escolha uma data.'; return; }

  const res = await fetch(`/available?date=${date}&minutes=${service.minutes}`);
  const slots = await res.json();
  if (slots.length === 0) slotsDiv.innerHTML = '<em>Nenhum horário disponível</em>';
  else {
    slotsDiv.innerHTML = '';
    slots.forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'slot-btn';
      btn.textContent = new Date(s).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      btn.onclick = () => bookSlot(s);
      slotsDiv.appendChild(btn);
    });
  }
});

async function bookSlot(startIso) {
  const client = document.getElementById('clientName').value.trim();
  const phone = document.getElementById('clientPhone').value.trim();
  const service = JSON.parse(document.getElementById('serviceSelect').value);

  if (!client || !phone) { msgDiv.textContent = 'Preencha nome e telefone.'; return; }
  const payload = { client, phone, service, start: startIso };
  const res = await fetch('/book', {
    method:'POST',
    headers:{'content-type':'application/json'},
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (data.ok) {
    msgDiv.textContent = 'Agendamento confirmado! Notificações agendadas.';
    await loadBookings();
  } else {
    msgDiv.textContent = 'Erro: ' + (data.error || 'não foi possível agendar.');
  }
}

loadBookings();
