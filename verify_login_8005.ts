const loginResp = await fetch("http://127.0.0.1:8005/api/v1/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "admin", password: "password" }) // Use generic test credentials
});

console.log("LOGIN STATUS:", loginResp.status);
if (loginResp.status === 200) {
  const data = await loginResp.json();
  console.log("LOGIN RESPONSE RECEIVED:", data.success ? "success" : "failed");
  console.log("ACCESS TOKEN:", data.data?.accessToken ? "received" : "missing");
  console.log("USER:", data.data?.user?.username, data.data?.user?.fullName);
  console.log("ROLES:", data.data?.user?.roles);
} else {
  const text = await loginResp.text();
  console.log("BODY:", text);
}

console.log("WAITING 2 SECONDS...");
await new Promise(r => setTimeout(r, 2000));

const healthResp = await fetch("http://127.0.0.1:8005/health");
console.log("HEALTH STATUS AFTER LOGIN:", healthResp.status);
const healthData = await healthResp.json();
console.log("HEALTH RESPONSE:", healthData.status);
