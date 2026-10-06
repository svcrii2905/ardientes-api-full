import bcrypt from "bcrypt";

async function run() {
  try {
    const hash = await bcrypt.hash("password", 10);
    console.log("Hash 10:", hash);
  } catch (e) {
    console.error("Error 10:", e);
  }
}
run();
