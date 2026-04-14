const normalizeTimeTo24 = (rawValue) => {
    const raw = String(rawValue || '').trim();
    if (!raw) return '';
    let token = raw;
    if (token.includes('T')) token = token.split('T').pop();
    if (token.includes(' ')) {
      const parts = token.split(' ').filter(Boolean);
      if (parts.length >= 2 && /^(am|pm)$/i.test(parts[parts.length - 1])) {
        token = `${parts[parts.length - 2]} ${parts[parts.length - 1]}`;
      } else { token = parts[0]; }
    }
    const match = token.match(/^(\d{1,2}):(\d{2})$/);
    if (match) return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
    return token.substring(0,5);
}
console.log(normalizeTimeTo24('09:00:00'));
console.log(normalizeTimeTo24('21:00:00'));
