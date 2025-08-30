import { serve } from "https://deno.land/std/http/server.ts"
import { Resend } from "npm:resend"

serve(async (req) => {
  const body = await req.json()
  const resend = new Resend(Deno.env.get("RESEND_API_KEY"))

  try {
    const res = await resend.emails.send({
      from: "Truyen Dich <no-reply@truyendich.app>",
      to: [body.to],
      subject: "Ca truyền đã kết thúc",
      html: `<p>Ca truyền của bệnh nhân <b>${body.patient}</b> đã kết thúc.</p>`,
    })
    return new Response(JSON.stringify(res))
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
})
