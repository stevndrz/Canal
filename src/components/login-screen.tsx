"use client";

import { useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, Play, Radio, ShieldCheck, Tv2, Wifi } from "lucide-react";

export function LoginScreen() {
  const [register, setRegister] = useState(false);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", household: "", email: "familia@demo.gt", password: "familia123" });

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    const res = await fetch(`/api/auth/${register ? "register" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "No pudimos iniciar sesión."); setLoading(false); return; }
    window.location.reload();
  }

  return <main className="min-h-screen bg-[#f4f7f6] lg:grid lg:grid-cols-[1.08fr_.92fr]">
    <section className="relative hidden min-h-screen overflow-hidden bg-[#082b25] p-14 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="absolute inset-0 auth-grid opacity-25" />
      <div className="absolute -right-28 top-36 h-96 w-96 rounded-full bg-[#21a179]/25 blur-3xl" />
      <div className="relative flex items-center gap-3 text-xl font-bold"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#28b486]"><Play className="ml-0.5 h-5 w-5 fill-white" /></span> CanalCasa</div>
      <div className="relative max-w-xl">
        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-100"><Radio className="h-3.5 w-3.5" /> TELEVISIÓN DE GUATEMALA</div>
        <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-.04em]">Tus canales de siempre,<br/><span className="text-[#59d4aa]">en toda la casa.</span></h1>
        <p className="mt-6 max-w-lg text-lg leading-8 text-emerald-50/70">Organiza las señales abiertas y oficiales que tu familia disfruta, conéctalas a tus pantallas y guarda tus favoritas en un solo lugar.</p>
        <div className="mt-10 grid grid-cols-3 gap-3">
          {[{ icon: Tv2, value: "Smart TV", label: "Conecta pantallas" }, { icon: Wifi, value: "En vivo", label: "Señales del hogar" }, { icon: ShieldCheck, value: "Privado", label: "Solo tu familia" }].map(({icon: Icon, value, label}) => <div key={value} className="rounded-2xl border border-white/10 bg-white/[.07] p-4 backdrop-blur"><Icon className="mb-3 h-5 w-5 text-[#59d4aa]"/><strong className="block text-sm">{value}</strong><span className="mt-1 block text-xs text-white/55">{label}</span></div>)}
        </div>
      </div>
      <p className="relative text-xs text-white/40">Hecho para hogares guatemaltecos · Usa únicamente fuentes autorizadas</p>
    </section>

    <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10">
      <div className="w-full max-w-md">
        <div className="mb-10 flex items-center gap-3 text-xl font-bold text-[#123d35] lg:hidden"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#28b486] text-white"><Play className="ml-0.5 h-5 w-5 fill-white" /></span> CanalCasa</div>
        <div className="mb-8"><p className="mb-2 text-sm font-semibold text-[#19906d]">{register ? "CREA TU HOGAR" : "BIENVENIDO DE NUEVO"}</p><h2 className="text-3xl font-bold tracking-[-.03em] text-[#102f2a]">{register ? "Empieza con CanalCasa" : "Entra a tu cuenta"}</h2><p className="mt-2 text-sm text-slate-500">{register ? "Organiza tus canales en pocos minutos." : "Continúa viendo tus canales favoritos."}</p></div>
        <form onSubmit={submit} className="space-y-4">
          {register && <div className="grid grid-cols-2 gap-3"><Field label="Tu nombre" value={form.name} onChange={(v) => setForm({...form,name:v})}/><Field label="Nombre del hogar" value={form.household} onChange={(v) => setForm({...form,household:v})}/></div>}
          <Field label="Correo electrónico" type="email" value={form.email} onChange={(v) => setForm({...form,email:v})}/>
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">Contraseña</span><span className="relative block"><LockKeyhole className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400"/><input className="input pl-10 pr-11" type={show ? "text" : "password"} value={form.password} onChange={(e) => setForm({...form,password:e.target.value})}/><button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-3 text-slate-400">{show ? <EyeOff className="h-5 w-5"/> : <Eye className="h-5 w-5"/>}</button></span></label>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#168766] font-semibold text-white shadow-lg shadow-emerald-800/10 transition hover:bg-[#0f7356] disabled:opacity-60">{loading && <Loader2 className="h-4 w-4 animate-spin"/>}{register ? "Crear mi hogar" : "Entrar a CanalCasa"}</button>
        </form>
        {!register && <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5 text-xs text-emerald-900"><div className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600"/><div><strong>Cuenta de demostración</strong><p className="mt-1 text-emerald-800/70">familia@demo.gt · familia123</p></div></div></div>}
        <p className="mt-7 text-center text-sm text-slate-500">{register ? "¿Ya tienes una cuenta?" : "¿Nuevo en CanalCasa?"} <button onClick={() => {setRegister(!register);setError("")}} className="font-semibold text-[#168766] hover:underline">{register ? "Inicia sesión" : "Crea tu hogar"}</button></p>
      </div>
    </section>
  </main>;
}

function Field({ label, value, onChange, type="text" }: { label:string; value:string; onChange:(v:string)=>void; type?:string }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span><input className="input" type={type} value={value} onChange={(e)=>onChange(e.target.value)} required/></label>;
}
