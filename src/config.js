// Where the backend API lives: the machine this app was opened from, on port
// 5001 — so every PC on the hospital network reaches the server's API, and the
// dev PC reaches its own. Screens import it instead of hard-coding
// "http://localhost:5001", which only ever worked on the server itself.
const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:5001`;

export { API_BASE_URL };
export default API_BASE_URL;
