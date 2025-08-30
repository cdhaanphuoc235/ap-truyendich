export async function sendEmail(to, patient) {
  await fetch("https://cvtqsticuhhvastpxdnw.functions.supabase.co/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, patient }),
  })
}
