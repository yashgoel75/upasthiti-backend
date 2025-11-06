import connect from "./lib/mongodb.js";

export async function register() {
  await connect();
}