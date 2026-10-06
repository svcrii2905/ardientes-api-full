import bcrypt from "npm:bcryptjs@2.4.3";

const password = "admin";
const hash = "$2b$10$wKxN5gW1B52Hn7aU8oA5/exy3c8uMh59uDsnQ3oW4q0P7FjE2Pfe.";

const action = Deno.args[0];

if (action === "sync") {
  console.log("Testing sync bcryptjs...");
  const valid = bcrypt.compareSync(password, hash);
  console.log("Valid sync:", valid);
} else if (action === "async") {
  console.log("Testing async bcryptjs...");
  const valid = await bcrypt.compare(password, hash);
  console.log("Valid async:", valid);
}
