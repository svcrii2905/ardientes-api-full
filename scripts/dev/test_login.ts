const resp = await fetch("http://127.0.0.1:8000/api/v1/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    username: "admin",
    password: "password"
  })
});
console.log("STATUS:", resp.status);
console.log("HEADERS:", Object.fromEntries(resp.headers.entries()));
const text = await resp.text();
console.log("BODY:", text);
