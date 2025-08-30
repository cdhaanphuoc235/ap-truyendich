import { useState, useEffect } from "react"
import { supabase } from "../services/supabase"
import { sendEmail } from "../services/emailService"

export default function HomePage({ user }) {
  const [form, setForm] = useState({
    patient_name: "",
    room: "",
    bed: "",
    volume: "",
    drops_per_ml: "",
    rate: "",
    notify_email: false
  })
  const [infusions, setInfusions] = useState([])
  const [history, setHistory] = useState([])

  useEffect(() => {
    fetchInfusions()

    // Yêu cầu quyền Notification khi khởi động
    if (Notification.permission !== "granted") {
      Notification.requestPermission()
    }
  }, [])

  // Đồng hồ đếm ngược cập nhật mỗi 1 giây
  useEffect(() => {
    const interval = setInterval(() => {
      checkCountdowns()
    }, 1000)

    return () => clearInterval(interval)
  }, [infusions])

  const fetchInfusions = async () => {
    const { data } = await supabase.from("infusions").select("*").eq("user_id", user.id)
    setInfusions(data.filter(i => i.status === "active"))
    setHistory(data.filter(i => i.status !== "active"))
  }

  const playAlarm = () => {
    const audio = new Audio("/alarm.mp3")
    audio.play()
  }

  const showNotification = (title, body) => {
    if (Notification.permission === "granted") {
      new Notification(title, { body })
    }
  }

  const checkCountdowns = async () => {
    const now = new Date()

    for (const i of infusions) {
      const end = new Date(i.end_time)
      const diff = end - now

      if (diff <= 0) {
        // Đã hết giờ → chuyển status, thông báo, email
        await supabase.from("infusions").update({ status: "finished" }).eq("id", i.id)
        playAlarm()
        showNotification("Ca truyền kết thúc", `Bệnh nhân ${i.patient_name}`)
        if (i.notify_email) {
          await sendEmail(user.email, i.patient_name)
        }
        fetchInfusions()
      }
    }
  }

  const handleStart = async () => {
    const minutes = (form.volume * form.drops_per_ml) / form.rate
    const endTime = new Date(Date.now() + minutes * 60000)

    await supabase.from("infusions").insert([{
      ...form,
      user_id: user.id,
      end_time: endTime,
      status: "active"
    }])
    fetchInfusions()
  }

  const handleCancel = async (id) => {
    await supabase.from("infusions").update({ status: "cancelled" }).eq("id", id)
    fetchInfusions()
  }

  const handleClearHistory = async () => {
    await supabase.from("infusions").delete().eq("user_id", user.id).neq("status", "active")
    fetchInfusions()
  }

  // Hàm hiển thị thời gian còn lại
  const renderCountdown = (endTime) => {
    const now = new Date()
    const end = new Date(endTime)
    const diff = Math.max(0, end - now)
    const mins = Math.floor(diff / 60000)
    const secs = Math.floor((diff % 60000) / 1000)
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  return (
    <div className="p-4">
      {/* Header */}
      <header className="flex justify-between mb-4">
        <h1 className="text-xl font-bold text-blue-600">Truyen dich</h1>
        <button onClick={() => supabase.auth.signOut()}>Đăng xuất</button>
      </header>

      {/* Form nhập liệu */}
      <section className="bg-blue-100 p-4 rounded-lg mb-4">
        <input className="w-full mb-2 p-2" placeholder="Họ và tên"
          onChange={e => setForm({ ...form, patient_name: e.target.value })} />
        <input className="w-full mb-2 p-2" placeholder="Phòng"
          onChange={e => setForm({ ...form, room: e.target.value })} />
        <input className="w-full mb-2 p-2" placeholder="Giường"
          onChange={e => setForm({ ...form, bed: e.target.value })} />
        <input className="w-full mb-2 p-2" placeholder="Thể tích (ml)" type="number"
          onChange={e => setForm({ ...form, volume: e.target.value })} />
        <input className="w-full mb-2 p-2" placeholder="Số giọt/ml" type="number"
          onChange={e => setForm({ ...form, drops_per_ml: e.target.value })} />
        <input className="w-full mb-2 p-2" placeholder="Tốc độ (giọt/phút)" type="number"
          onChange={e => setForm({ ...form, rate: e.target.value })} />
        <label className="flex items-center">
          <input type="checkbox"
            onChange={e => setForm({ ...form, notify_email: e.target.checked })} />
          <span className="ml-2">Nhận thông báo qua email</span>
        </label>
        <button onClick={handleStart} className="bg-blue-600 text-white w-full mt-2 p-2 rounded-lg">
          Bắt đầu truyền
        </button>
      </section>

      {/* Danh sách ca đang truyền */}
      <section className="mb-4">
        <h2 className="font-bold text-lg mb-2">Ca đang truyền</h2>
        {infusions.map(i => (
          <div key={i.id} className="bg-white shadow p-2 mb-2 rounded-lg">
            <p><b>{i.patient_name}</b> - Phòng {i.room}, Giường {i.bed}</p>
            <p>⏳ Thời gian còn lại: {renderCountdown(i.end_time)}</p>
            <p>Kết thúc lúc: {new Date(i.end_time).toLocaleTimeString()}</p>
            <button onClick={() => handleCancel(i.id)} className="text-red-500 mt-1">Hủy</button>
          </div>
        ))}
      </section>

      {/* Lịch sử */}
      <section>
        <h2 className="font-bold text-lg mb-2">Lịch sử</h2>
        {history.map(i => (
          <div key={i.id} className="bg-gray-100 p-2 mb-2 rounded-lg">
            <p>{i.patient_name} ({i.status})</p>
          </div>
        ))}
        <button onClick={handleClearHistory} className="bg-red-500 text-white p-2 rounded-lg mt-2">
          Xóa tất cả lịch sử
        </button>
      </section>

      <footer className="text-center mt-6 text-sm text-gray-500">
        Sử dụng cho Điều dưỡng An Phước
      </footer>
    </div>
  )
}
