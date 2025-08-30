import { supabase } from "../services/supabase"

export default function LoginForm() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google'
    })
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-blue-600 text-white">
      <img src="/logo.png" alt="logo" className="w-24 mb-4" />
      <h1 className="text-2xl font-bold mb-2">Truyen dich</h1>
      <p className="mb-6">Ứng dụng hỗ trợ điều dưỡng An Phước</p>
      <button 
        onClick={handleLogin} 
        className="bg-white text-blue-600 px-4 py-2 rounded-lg shadow-md">
        Đăng nhập bằng Google
      </button>
    </div>
  )
}
