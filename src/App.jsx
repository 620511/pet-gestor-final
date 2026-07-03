// ═══════════════════════════════════════════════════════════════
//  PET GESTOR — SaaS PDV Multi-tenant
//  Stack: React + Supabase (Auth + DB + RLS)
//  Instruções: configure SUPABASE_URL e SUPABASE_ANON_KEY abaixo
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";
import { PWABanner } from "./components/PWABanner.jsx";
import { ForgotPassword, Planos, PlanGate, ImportCSV, EntradaEstoque, CancelSale, Relatorio, Funcionarios, AdminMaster } from "./modules.jsx";

// ─── CONFIG SUPABASE ─────────────────────────────────────────
// ⚠️  Substitua pelos valores do seu projeto em supabase.com
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL || "https://SEU_PROJETO.supabase.co";
const SUPABASE_KEY  = import.meta.env.VITE_SUPABASE_KEY || "SUA_ANON_KEY";

// Supabase client minimalista (sem instalar pacote)
const sb = {
  _h: () => ({ "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${sb._token || SUPABASE_KEY}` }),
  _token: null,
  _uid: null,

  auth: {
    async signUp(email, password, meta = {}) {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ email, password, data: meta }),
      });
      const d = await r.json();
      if (d.access_token) { sb._token = d.access_token; sb._uid = d.user?.id; }
      return d;
    },
    async signIn(email, password) {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (d.access_token) {
        sb._token = d.access_token; sb._uid = d.user?.id;
        localStorage.setItem("pg_token", d.access_token);
        localStorage.setItem("pg_uid", d.user?.id);
        localStorage.setItem("pg_refresh", d.refresh_token || "");
      }
      return d;
    },
    async signOut() {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: "POST", headers: sb._h() });
      sb._token = null; sb._uid = null;
      localStorage.removeItem("pg_token"); localStorage.removeItem("pg_uid"); localStorage.removeItem("pg_refresh");
    },
    async refresh() {
      const rt = localStorage.getItem("pg_refresh");
      if (!rt) return null;
      const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
        body: JSON.stringify({ refresh_token: rt }),
      });
      const d = await r.json();
      if (d.access_token) {
        sb._token = d.access_token; sb._uid = d.user?.id;
        localStorage.setItem("pg_token", d.access_token);
        localStorage.setItem("pg_uid", d.user?.id);
        localStorage.setItem("pg_refresh", d.refresh_token || "");
        return d;
      }
      return null;
    },
    getUser() { return { id: sb._uid }; },
  },

  // ── REST helpers ──────────────────────────────────────────
  async from(table) { return new Query(table); },
  _q(table) { return new Query(table); },
};

class Query {
  constructor(table) {
    this.table = table; this.params = []; this.body = null; this.method = "GET";
    this.headers = {};
  }
  select(cols = "*") { this.cols = cols; return this; }
  eq(col, val) { this.params.push(`${col}=eq.${val}`); return this; }
  gte(col, val) { this.params.push(`${col}=gte.${val}`); return this; }
  lte(col, val) { this.params.push(`${col}=lte.${val}`); return this; }
  order(col, { ascending = true } = {}) { this.params.push(`order=${col}.${ascending ? "asc" : "desc"}`); return this; }
  limit(n) { this.params.push(`limit=${n}`); return this; }
  single() { this.headers["Accept"] = "application/vnd.pgrst.object+json"; return this; }
  insert(data) { this.method = "POST"; this.body = data; return this; }
  update(data) { this.method = "PATCH"; this.body = data; return this; }
  delete() { this.method = "DELETE"; return this; }
  select_after() { this.headers["Prefer"] = "return=representation"; return this; }

  async then(resolve, reject) {
    try {
      const qs = this.params.length ? "?" + this.params.join("&") : "";
      const url = `${SUPABASE_URL}/rest/v1/${this.table}${qs}`;
      const res = await fetch(url, {
        method: this.method,
        headers: { ...sb._h(), ...this.headers },
        body: this.body ? JSON.stringify(this.body) : undefined,
      });
      if (res.status === 204) return resolve({ data: null, error: null });
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { data = text; }
      if (!res.ok) return resolve({ data: null, error: data });
      resolve({ data, error: null });
    } catch (e) { resolve({ data: null, error: e }); }
  }
}

const q = (table) => new Query(table);

// ─── CONSTANTES ───────────────────────────────────────────────
const CATEGORIES = {
  racao:    { label: "Ração",      color: "#f59e0b" },
  saude:    { label: "Saúde",      color: "#10b981" },
  acessorio:{ label: "Acessório",  color: "#6366f1" },
  higiene:  { label: "Higiene",    color: "#3b82f6" },
  agro:     { label: "Agro",       color: "#84cc16" },
  petisco:  { label: "Petisco",    color: "#f97316" },
  servico:  { label: "Serviço",    color: "#ec4899" },
};
const PAYMENTS = ["Dinheiro", "PIX", "Cartão Débito", "Cartão Crédito", "Fiado"];
const PLANS = { free: "Gratuito", pro: "Pro", premium: "Premium" };
const fmt = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().split("T")[0];

// ─── CONTEXT ─────────────────────────────────────────────────
const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

// ─── ICONS ───────────────────────────────────────────────────
const ICON_PATHS = {
  search: "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z",
  cart:   "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0",
  trash:  "M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2",
  plus:   "M12 5v14M5 12h14",
  minus:  "M5 12h14",
  x:      "M18 6L6 18M6 6l12 12",
  check:  "M20 6L9 17l-5-5",
  edit:   "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  chart:  "M18 20V10M12 20V4M6 20v-6",
  dollar: "M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6",
  alert:  "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  tag:    "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01",
  logout: "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  store:  "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10",
  qr:     "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v3h-3M17 20h3M20 17v3",
  user:   "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  lock:   "M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4",
  eye:    "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z",
  settings:"M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
};
const Ic = ({ n, s = 18, c }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c || "currentColor"} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={ICON_PATHS[n] || ""} />
  </svg>
);

// ─── BUTTON / INPUT helpers ───────────────────────────────────
const Btn = ({ children, onClick, variant = "primary", disabled, full, small, style: sx }) => {
  const base = { display:"flex", alignItems:"center", justifyContent:"center", gap:6, border:"none", borderRadius:10, cursor: disabled ? "not-allowed" : "pointer", fontWeight:700, fontSize: small ? 12 : 14, padding: small ? "7px 12px" : "11px 18px", opacity: disabled ? .5 : 1, width: full ? "100%" : undefined, transition:"all .15s", ...sx };
  const vars = { primary:{background:"#4ade80",color:"#000"}, secondary:{background:"#1e293b",color:"#e2e8f0"}, danger:{background:"#ef4444",color:"#fff"}, ghost:{background:"none",color:"#94a3b8",border:"1px solid #1e293b"} };
  return <button style={{ ...base, ...vars[variant] }} onClick={onClick} disabled={disabled}>{children}</button>;
};
const Inp = ({ label, ...p }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={S.label}>{label}</label>}
    <input style={S.input} {...p} />
  </div>
);
const Sel = ({ label, children, ...p }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={S.label}>{label}</label>}
    <select style={S.input} {...p}>{children}</select>
  </div>
);

// ─── MODAL ────────────────────────────────────────────────────
const Modal = ({ title, onClose, children, wide }) => (
  <div style={S.overlay} onClick={onClose}>
    <div style={{ ...S.modal, maxWidth: wide ? 680 : 480 }} onClick={e => e.stopPropagation()}>
      <div style={S.modalHdr}>
        <span style={{ fontWeight:700, fontSize:15 }}>{title}</span>
        <button style={S.iconBtn} onClick={onClose}><Ic n="x" /></button>
      </div>
      <div style={{ padding:"18px 22px 24px" }}>{children}</div>
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════
//  AUTH — Tela de Login / Cadastro
// ══════════════════════════════════════════════════════════════
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");   // login | register | forgot
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [storeName, setStoreName] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showPass, setShowPass] = useState(false);

  const submit = async () => {
    setErr(""); setLoading(true);
    try {
      if (mode === "login") {
        const d = await sb.auth.signIn(email, pass);
        if (d.error || d.error_description) { setErr(d.error_description || "Email ou senha inválidos"); return; }
        onAuth(d.user || { id: sb._uid });
      } else {
        if (!storeName.trim()) { setErr("Informe o nome da loja"); return; }
        const d = await sb.auth.signUp(email, pass);
        if (d.error || d.error_description) { setErr(d.error_description || "Erro ao cadastrar"); return; }
        // Cria a loja
        const slug = storeName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Date.now();
        await q("stores").insert({ owner_id: d.user?.id || sb._uid, name: storeName, slug, city, state: "CE" }).select_after();
        onAuth(d.user || { id: sb._uid });
      }
    } catch(e) { setErr("Erro de conexão. Verifique o Supabase."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#080f1a", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      {/* BG decoration */}
      <div style={{ position:"fixed", top:-100, right:-100, width:400, height:400, background:"radial-gradient(circle, #4ade8022 0%, transparent 70%)", pointerEvents:"none" }} />
      <div style={{ position:"fixed", bottom:-100, left:-100, width:300, height:300, background:"radial-gradient(circle, #6366f122 0%, transparent 70%)", pointerEvents:"none" }} />

      <div style={{ background:"#0d1b2a", border:"1px solid #1e293b", borderRadius:24, padding:"40px 36px", width:"100%", maxWidth:420, position:"relative" }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ fontSize:52, marginBottom:8 }}>🐾</div>
          <div style={{ fontSize:26, fontWeight:900, color:"#fff", letterSpacing:"-0.5px" }}>Pet Gestor</div>
          <div style={{ fontSize:13, color:"#475569", marginTop:4 }}>PDV · Petshop & Agroshop · SaaS</div>
        </div>

        {/* Mode toggle */}
        <div style={{ display:"flex", background:"#0f172a", borderRadius:12, padding:4, marginBottom:28 }}>
          {[["login","Entrar"],["register","Criar conta"]].map(([m,l]) => (
            <button key={m} style={{ flex:1, padding:"9px 0", border:"none", borderRadius:9, cursor:"pointer", fontWeight:700, fontSize:13, transition:"all .15s",
              background: mode===m ? "#1e293b" : "none", color: mode===m ? "#4ade80" : "#475569" }}
              onClick={() => { setMode(m); setErr(""); }}>{l}</button>
          ))}
        </div>

        {err && <div style={{ background:"#ef444422", border:"1px solid #ef4444", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#f87171", marginBottom:16 }}>{err}</div>}

        <Inp label="E-mail" type="email" placeholder="seu@email.com" value={email} onChange={e=>setEmail(e.target.value)} />

        <div style={{ position:"relative", marginBottom:14 }}>
          <label style={S.label}>Senha</label>
          <input style={S.input} type={showPass?"text":"password"} placeholder="••••••••" value={pass} onChange={e=>setPass(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&submit()} />
          <button style={{ position:"absolute", right:10, top:30, background:"none", border:"none", color:"#475569", cursor:"pointer" }}
            onClick={()=>setShowPass(v=>!v)}><Ic n="eye" s={16} /></button>
        </div>

        {mode === "register" && <>
          <Inp label="Nome da Loja" placeholder="Ex: PetShop Silva" value={storeName} onChange={e=>setStoreName(e.target.value)} />
          <Inp label="Cidade" placeholder="Ex: Fortaleza" value={city} onChange={e=>setCity(e.target.value)} />
        </>}

        {mode !== "forgot" && (
          <Btn full onClick={submit} disabled={loading}>
            {loading ? "Aguarde..." : mode==="login" ? "Entrar" : "Criar minha loja"}
          </Btn>
        )}

        {mode === "forgot" && (
          <ForgotPassword
            onBack={() => setMode("login")}
            SUPABASE_URL={SUPABASE_URL}
            SUPABASE_KEY={SUPABASE_KEY}
          />
        )}

        {mode === "login" && (
          <div style={{ textAlign:"center", marginTop:14 }}>
            <button style={{ background:"none", border:"none", color:"#334155", cursor:"pointer", fontSize:12, textDecoration:"underline" }}
              onClick={() => setMode("forgot")}>
              Esqueci minha senha
            </button>
          </div>
        )}

        <div style={{ textAlign:"center", marginTop:16, fontSize:12, color:"#334155" }}>
          Plano gratuito inclui até 100 produtos e 500 vendas/mês
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  SETUP — Tela de configuração inicial da loja
// ══════════════════════════════════════════════════════════════
function SetupStore({ userId, onDone }) {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("CE");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const slug = name.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"") + "-" + Date.now();
    const { data, error } = await q("stores").insert({ owner_id: userId, name, slug, city, state, phone }).select_after();
    if (!error && data) onDone(Array.isArray(data) ? data[0] : data);
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#080f1a", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#0d1b2a", border:"1px solid #1e293b", borderRadius:24, padding:40, width:"100%", maxWidth:440 }}>
        <div style={{ fontSize:40, marginBottom:8 }}>🏪</div>
        <h2 style={{ margin:"0 0 4px", color:"#fff" }}>Configure sua loja</h2>
        <p style={{ color:"#475569", fontSize:14, marginBottom:28 }}>Isso leva menos de 1 minuto</p>
        <Inp label="Nome da Loja *" placeholder="Ex: PetShop Silva" value={name} onChange={e=>setName(e.target.value)} />
        <Inp label="Cidade" placeholder="Fortaleza" value={city} onChange={e=>setCity(e.target.value)} />
        <Sel label="Estado" value={state} onChange={e=>setState(e.target.value)}>
          {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(s=><option key={s}>{s}</option>)}
        </Sel>
        <Inp label="Telefone/WhatsApp" placeholder="(85) 99999-9999" value={phone} onChange={e=>setPhone(e.target.value)} />
        <Btn full onClick={save} disabled={loading || !name.trim()}>
          {loading ? "Criando..." : "Começar a usar →"}
        </Btn>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  PDV
// ══════════════════════════════════════════════════════════════
function PDV() {
  const { store, cashSession, setCashSession } = useApp();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [cart, setCart] = useState([]);
  const [payment, setPayment] = useState("PIX");
  const [discount, setDiscount] = useState(0);
  const [customer, setCustomer] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBC, setShowBC] = useState(false);
  const searchRef = useRef();

  useEffect(() => { loadProducts(); searchRef.current?.focus(); }, []);

  const loadProducts = async () => {
    const { data } = await q("products").eq("store_id", store.id).eq("active", true).order("name");
    setProducts(data || []); setLoading(false);
  };

  const filtered = products.filter(p => {
    const s = search.toLowerCase();
    return (p.name.toLowerCase().includes(s) || (p.barcode||"").includes(s)) &&
      (filter === "all" || p.category === filter);
  });

  const addToCart = (prod, qty=1) => {
    if (prod.stock <= 0) return;
    setCart(c => {
      const ex = c.find(i=>i.id===prod.id);
      if (ex) return c.map(i=>i.id===prod.id ? {...i, qty: Math.min(i.qty+qty, prod.stock)} : i);
      return [...c, {...prod, qty}];
    });
  };

  const subtotal = cart.reduce((s,i)=>s+i.price*i.qty,0);
  const discVal  = Math.min(discount, subtotal);
  const total    = subtotal - discVal;

  const finalize = async () => {
    if (!cart.length) return;
    if (!cashSession) { alert("Abra o caixa antes de vender!"); return; }
    setSaving(true);
    // 1. Salva venda
    const { data: sale, error } = await q("sales").insert({
      store_id: store.id, cash_session_id: cashSession.id,
      customer_name: customer || "Consumidor Final",
      subtotal, discount: discVal, total, payment, status: "completed"
    }).select_after();
    if (error || !sale) { alert("Erro ao salvar venda"); setSaving(false); return; }
    const saleId = (Array.isArray(sale) ? sale[0] : sale).id;
    // 2. Salva itens (trigger decrementa estoque automaticamente)
    await q("sale_items").insert(cart.map(i=>({
      sale_id: saleId, product_id: i.id, product_name: i.name,
      qty: i.qty, unit_price: i.price, unit_cost: i.cost || 0, total: i.price*i.qty
    })));
    setReceipt({ id: saleId, customer: customer||"Consumidor Final", items: cart, subtotal, discount:discVal, total, payment, date: new Date().toISOString() });
    setCart([]); setDiscount(0); setCustomer("");
    loadProducts(); // atualiza estoque
    setSaving(false);
  };

  if (receipt) return <ReceiptView receipt={receipt} store={store} onClose={()=>setReceipt(null)} />;

  return (
    <div style={S.pdvLayout}>
      {/* PRODUTOS */}
      <div style={S.pdvLeft}>
        <div style={S.searchBar}>
          <div style={S.searchWrap}>
            <Ic n="search" s={16} /><input ref={searchRef} style={S.searchInput} placeholder="Buscar produto por nome ou código…" value={search} onChange={e=>setSearch(e.target.value)} />
          </div>
          <Btn variant="secondary" onClick={()=>setShowBC(true)} small><Ic n="qr" s={14}/> Barras</Btn>
        </div>
        <div style={S.filterRow}>
          {[["all","Todos"],...Object.entries(CATEGORIES).map(([k,v])=>[k,v.label])].map(([k,l])=>(
            <button key={k} style={{...S.filterBtn,...(filter===k?{background:"#4ade80",color:"#000"}:{})}} onClick={()=>setFilter(k)}>{l}</button>
          ))}
        </div>
        {loading ? <div style={{padding:40,textAlign:"center",color:"#475569"}}>Carregando produtos…</div> : (
          <div style={S.productGrid}>
            {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:40,color:"#475569"}}>Nenhum produto</div>}
            {filtered.map(p=>(
              <button key={p.id} style={{...S.productCard,...(p.stock<=0?S.productCardOOS:{})}} onClick={()=>addToCart(p)} disabled={p.stock<=0}>
                {p.stock<=p.min_stock&&p.stock>0&&<div style={S.lowBadge}><Ic n="alert" s={9}/> Baixo</div>}
                <div style={{fontSize:28}}>{p.emoji}</div>
                <div style={S.productName}>{p.name}</div>
                <div style={{marginTop:2}}><span style={{...S.catBadge,background:(CATEGORIES[p.category]?.color||"#666")+"33",color:CATEGORIES[p.category]?.color||"#666",fontSize:10}}>{CATEGORIES[p.category]?.label||p.category}</span></div>
                <div style={S.productPrice}>{fmt(p.price)}</div>
                <div style={{fontSize:11,color:p.stock<=p.min_stock?"#f59e0b":"#475569",marginTop:2}}>{p.stock<=0?"❌ Sem estoque":`Estq: ${p.stock} ${p.unit}`}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CARRINHO */}
      <div style={S.pdvRight}>
        <div style={S.cartHdr}>
          <Ic n="cart" s={18}/><span style={{fontWeight:700,fontSize:15}}>Carrinho</span>
          {cart.length>0&&<button style={{...S.iconBtn,marginLeft:"auto",color:"#ef4444"}} onClick={()=>setCart([])}><Ic n="trash" s={15}/></button>}
        </div>
        <div style={{padding:"8px 14px 4px"}}>
          <input style={{...S.input,fontSize:13}} placeholder="Nome do cliente (opcional)" value={customer} onChange={e=>setCustomer(e.target.value)} />
        </div>
        <div style={S.cartItems}>
          {!cart.length&&<div style={{textAlign:"center",color:"#334155",padding:28}}><div style={{fontSize:36}}>🛒</div><div style={{marginTop:6,fontSize:13}}>Carrinho vazio</div></div>}
          {cart.map(item=>(
            <div key={item.id} style={S.cartItem}>
              <span style={{fontSize:20}}>{item.emoji}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:"#e2e8f0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.name}</div>
                <div style={{fontSize:11,color:"#4ade80"}}>{fmt(item.price)} × {item.qty}</div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:3}}>
                <button style={S.qtyBtn} onClick={()=>setCart(c=>c.map(i=>i.id===item.id?{...i,qty:i.qty-1}:i).filter(i=>i.qty>0))}><Ic n="minus" s={11}/></button>
                <span style={{minWidth:22,textAlign:"center",fontSize:13,fontWeight:700}}>{item.qty}</span>
                <button style={S.qtyBtn} onClick={()=>setCart(c=>c.map(i=>i.id===item.id?{...i,qty:Math.min(i.qty+1,i.stock)}:i))}><Ic n="plus" s={11}/></button>
              </div>
            </div>
          ))}
        </div>
        <div style={S.cartFooter}>
          <div style={S.totalRow}><span style={{color:"#475569"}}>Subtotal</span><span>{fmt(subtotal)}</span></div>
          <div style={S.totalRow}>
            <span style={{color:"#475569"}}>Desconto R$</span>
            <input style={{...S.input,width:80,textAlign:"right",padding:"4px 8px",fontSize:13}} type="number" min={0} step={.5} value={discount} onChange={e=>setDiscount(+e.target.value)} />
          </div>
          <div style={{...S.totalRow,fontSize:20,fontWeight:900,color:"#4ade80",borderTop:"1px solid #1e293b",paddingTop:10,marginTop:4}}>
            <span>TOTAL</span><span>{fmt(total)}</span>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:10}}>
            {PAYMENTS.map(m=>(
              <button key={m} style={{...S.payBtn,...(payment===m?{background:"#4ade80",color:"#000"}:{})}} onClick={()=>setPayment(m)}>{m}</button>
            ))}
          </div>
          <Btn full onClick={finalize} disabled={!cart.length||saving} style={{marginTop:12,padding:14,fontSize:15,borderRadius:14}}>
            {saving?"Salvando…":cart.length?`✓ FINALIZAR — ${fmt(total)}`:"Adicione produtos"}
          </Btn>
        </div>
      </div>

      {showBC&&<BarcodeModal products={products} onClose={()=>setShowBC(false)} onAdd={addToCart}/>}
    </div>
  );
}

// ─── BARCODE MODAL ────────────────────────────────────────────
function BarcodeModal({ products, onClose, onAdd }) {
  const [code, setCode] = useState("");
  const [qty, setQty] = useState(1);
  const found = products.find(p=>(p.barcode||"")===code.trim());
  const ref = useRef(); useEffect(()=>{ref.current?.focus();},[]);
  return (
    <Modal title="Código de Barras" onClose={onClose}>
      <p style={{color:"#475569",fontSize:13,marginBottom:14}}>Digite ou use um leitor USB/Bluetooth</p>
      <input ref={ref} style={{...S.input,fontSize:18,fontFamily:"monospace",letterSpacing:".1em",marginBottom:12}}
        placeholder="7891234560001" value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&found&&(onAdd(found,qty),onClose())} />
      {found&&(
        <div style={{background:"rgba(74,222,128,.12)",border:"1px solid #4ade80",borderRadius:10,padding:14,display:"flex",gap:12,alignItems:"center",marginBottom:14}}>
          <span style={{fontSize:28}}>{found.emoji}</span>
          <div><div style={{fontWeight:700}}>{found.name}</div><div style={{color:"#4ade80",fontSize:13}}>{fmt(found.price)} · Estq: {found.stock}</div></div>
        </div>
      )}
      {code&&!found&&<div style={{background:"rgba(239,68,68,.12)",border:"1px solid #ef4444",borderRadius:10,padding:12,fontSize:13,color:"#f87171",marginBottom:14}}>Produto não encontrado</div>}
      {found&&(
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <span style={{color:"#475569",fontSize:13}}>Qtd:</span>
          <div style={{display:"flex",gap:4,alignItems:"center"}}>
            <button style={S.qtyBtn} onClick={()=>setQty(q=>Math.max(1,q-1))}><Ic n="minus" s={12}/></button>
            <span style={{minWidth:28,textAlign:"center",fontWeight:700}}>{qty}</span>
            <button style={S.qtyBtn} onClick={()=>setQty(q=>q+1)}><Ic n="plus" s={12}/></button>
          </div>
          <Btn onClick={()=>{onAdd(found,qty);onClose();}} style={{flex:1}}>Adicionar</Btn>
        </div>
      )}
    </Modal>
  );
}

// ─── CUPOM ────────────────────────────────────────────────────
function ReceiptView({ receipt, store, onClose }) {
  return (
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",minHeight:"80vh",padding:20}}>
      <div style={{background:"#fff",color:"#111",borderRadius:16,padding:"28px 24px",maxWidth:360,width:"100%",fontFamily:"monospace"}}>
        <div style={{textAlign:"center",marginBottom:14}}>
          <div style={{fontSize:32}}>{store.logo_emoji||"🐾"}</div>
          <div style={{fontWeight:900,fontSize:16,textTransform:"uppercase"}}>{store.name}</div>
          <div style={{fontSize:11,color:"#666"}}>{store.city} · {store.state}</div>
          <div style={{fontSize:11,color:"#999"}}>{new Date(receipt.date).toLocaleString("pt-BR")}</div>
        </div>
        <div style={{borderTop:"2px dashed #ccc",borderBottom:"2px dashed #ccc",padding:"10px 0",marginBottom:10}}>
          {receipt.items.map((i,idx)=>(
            <div key={idx} style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
              <span>{i.qty}× {i.name.substring(0,22)}</span><span>{fmt(i.price*i.qty)}</span>
            </div>
          ))}
        </div>
        <div style={{fontSize:13}}>
          <div style={{display:"flex",justifyContent:"space-between"}}><span>Subtotal:</span><span>{fmt(receipt.subtotal)}</span></div>
          {receipt.discount>0&&<div style={{display:"flex",justifyContent:"space-between",color:"#e53"}}><span>Desconto:</span><span>-{fmt(receipt.discount)}</span></div>}
          <div style={{display:"flex",justifyContent:"space-between",fontWeight:900,fontSize:16,marginTop:6}}><span>TOTAL:</span><span>{fmt(receipt.total)}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",color:"#555",marginTop:4}}><span>Pagamento:</span><span>{receipt.payment}</span></div>
        </div>
        <div style={{textAlign:"center",marginTop:14,fontSize:11,color:"#888"}}>Obrigado pela preferência! 🐾<br/>{store.name}</div>
        <button style={{...S.btn,background:"#080f1a",color:"#fff",width:"100%",marginTop:18,borderRadius:10,justifyContent:"center"}} onClick={onClose}>Nova Venda</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  ESTOQUE
// ══════════════════════════════════════════════════════════════
function EstoqueInner({ onMovimento }) {
  const { store } = useApp();
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const empty = { name:"", category:"racao", species:"cao", price:"", cost:"", stock:"", min_stock:5, unit:"un", emoji:"📦", barcode:"", active:true };
  const [form, setForm] = useState(empty);

  useEffect(()=>{load();},[]);
  const load = async () => {
    const { data } = await q("products").eq("store_id", store.id).order("name");
    setProducts(data||[]); setLoading(false);
  };

  const filtered = products.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())||(p.barcode||"").includes(search));
  const lowStock = products.filter(p=>p.stock<=p.min_stock&&p.stock>0);
  const zero = products.filter(p=>p.stock<=0);

  const save = async () => {
    const payload = { ...form, price:+form.price, cost:+form.cost, stock:+form.stock, min_stock:+form.min_stock };
    if (editing) {
      await q("products").eq("id",editing.id).update({...payload,updated_at:new Date().toISOString()});
    } else {
      await q("products").insert({...payload, store_id:store.id});
    }
    setEditing(null); setShowAdd(false); setForm(empty); load();
  };

  const del = async (id) => { if(!window.confirm("Excluir produto?"))return; await q("products").eq("id",id).update({active:false}); load(); };

  return (
    <div style={S.module}>
      {(lowStock.length>0||zero.length>0)&&(
        <div style={S.alertBanner}>
          <Ic n="alert" s={16}/>
          <span>{zero.length>0&&`${zero.length} produto(s) zerado(s). `}{lowStock.length>0&&`${lowStock.length} com estoque baixo.`}</span>
        </div>
      )}
      <div style={S.moduleHdr}>
        <h2 style={S.h2}>📦 Estoque <span style={{fontSize:14,fontWeight:400,color:"#475569"}}>({products.length} produtos)</span></h2>
        <div style={{display:"flex",gap:10}}>
          <div style={S.searchWrap}><Ic n="search" s={14}/><input style={S.searchInput} placeholder="Buscar…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
          <Btn onClick={()=>{setForm(empty);setEditing(null);setShowAdd(true);}}><Ic n="plus" s={14}/>Novo</Btn>
        </div>
      </div>

      {loading?<div style={{padding:40,textAlign:"center",color:"#475569"}}>Carregando…</div>:(
        <div style={S.table}>
          <div style={S.tableHd}>
            <span style={{flex:2}}>Produto</span><span style={{flex:1}}>Categoria</span>
            <span style={{textAlign:"right"}}>Custo</span><span style={{textAlign:"right"}}>Preço</span>
            <span style={{textAlign:"right"}}>Estoque</span><span style={{textAlign:"right"}}>Mín.</span>
            <span style={{textAlign:"center",width:80}}>Ações</span>
          </div>
          {filtered.map(p=>(
            <div key={p.id} style={{...S.tableRow,...(p.stock<=p.min_stock?{background:"rgba(245,158,11,.06)"}:{})}}>
              <span style={{flex:2,display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:18}}>{p.emoji}</span>
                <span style={{fontSize:13}}>{p.name}</span>
                {p.stock<=0&&<span style={{background:"#ef444422",color:"#ef4444",fontSize:10,padding:"1px 6px",borderRadius:4,fontWeight:700}}>Zerado</span>}
                {p.stock<=p.min_stock&&p.stock>0&&<span style={{background:"#f59e0b22",color:"#f59e0b",fontSize:10,padding:"1px 6px",borderRadius:4,fontWeight:700}}>Baixo</span>}
              </span>
              <span style={{flex:1}}><span style={{...S.catBadge,background:(CATEGORIES[p.category]?.color||"#666")+"22",color:CATEGORIES[p.category]?.color||"#666",fontSize:10}}>{CATEGORIES[p.category]?.label||p.category}</span></span>
              <span style={{textAlign:"right",fontSize:13,color:"#475569"}}>{fmt(p.cost)}</span>
              <span style={{textAlign:"right",fontSize:13,color:"#4ade80",fontWeight:700}}>{fmt(p.price)}</span>
              <span style={{textAlign:"right",fontWeight:700,color:p.stock<=p.min_stock?"#f59e0b":"#e2e8f0"}}>{p.stock} {p.unit}</span>
              <span style={{textAlign:"right",fontSize:13,color:"#334155"}}>{p.min_stock}</span>
              <span style={{display:"flex",gap:4,justifyContent:"center",width:110}}>
                <button style={{...S.iconBtn,color:"#4ade80",fontSize:12,padding:"4px 8px",border:"1px solid #1e293b",borderRadius:6}} title="Movimentar estoque" onClick={()=>onMovimento&&onMovimento(p)}>📦+</button>
                <button style={S.iconBtn} onClick={()=>{setForm({...p,price:String(p.price),cost:String(p.cost),stock:String(p.stock),min_stock:String(p.min_stock)});setEditing(p);setShowAdd(true);}}><Ic n="edit" s={14}/></button>
                <button style={{...S.iconBtn,color:"#ef4444"}} onClick={()=>del(p.id)}><Ic n="trash" s={14}/></button>
              </span>
            </div>
          ))}
        </div>
      )}

      {showAdd&&(
        <Modal title={editing?"Editar Produto":"Novo Produto"} onClose={()=>{setShowAdd(false);setEditing(null);}} wide>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1"}}><Inp label="Nome *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
            <div><Inp label="Emoji" value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))} maxLength={2}/></div>
            <div><Inp label="Código de Barras" value={form.barcode} onChange={e=>setForm(f=>({...f,barcode:e.target.value}))}/></div>
            <div><Sel label="Categoria" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>{Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</Sel></div>
            <div><Sel label="Espécie" value={form.species} onChange={e=>setForm(f=>({...f,species:e.target.value}))}>{["cao","gato","aves","bovino","todos"].map(s=><option key={s} value={s}>{s}</option>)}</Sel></div>
            <div><Inp label="Preço de Venda" type="number" step=".01" value={form.price} onChange={e=>setForm(f=>({...f,price:e.target.value}))}/></div>
            <div><Inp label="Custo" type="number" step=".01" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))}/></div>
            <div><Inp label="Estoque Atual" type="number" value={form.stock} onChange={e=>setForm(f=>({...f,stock:e.target.value}))}/></div>
            <div><Inp label="Estoque Mínimo" type="number" value={form.min_stock} onChange={e=>setForm(f=>({...f,min_stock:e.target.value}))}/></div>
            <div><Sel label="Unidade" value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>{["un","kg","sc","fr","cx","lt","g","ml"].map(u=><option key={u}>{u}</option>)}</Sel></div>
          </div>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <Btn full onClick={save} disabled={!form.name}>Salvar</Btn>
            <Btn full variant="secondary" onClick={()=>{setShowAdd(false);setEditing(null);}}>Cancelar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  CONTABILIDADE
// ══════════════════════════════════════════════════════════════
function Contabilidade({ onCancelSale }) {
  const { store, cashSession, setCashSession } = useApp();
  const [tab, setTab] = useState("caixa");
  const [period, setPeriod] = useState(today());
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [showExpense, setShowExpense] = useState(false);
  const [expForm, setExpForm] = useState({ description:"", category:"despesa", amount:"", expense_date:today() });
  const [loading, setLoading] = useState(true);
  const [initVal, setInitVal] = useState("");

  useEffect(()=>{loadAll();},[period]);
  const loadAll = async () => {
    setLoading(true);
    const [s,e] = await Promise.all([
      q("sales").eq("store_id",store.id).gte("created_at",period+"T00:00:00").lte("created_at",period+"T23:59:59").order("created_at",{ascending:false}),
      q("expenses").eq("store_id",store.id).eq("expense_date",period).order("created_at",{ascending:false}),
    ]);
    setSales(s.data||[]); setExpenses(e.data||[]); setLoading(false);
  };

  const openCash = async () => {
    const { data } = await q("cash_sessions").insert({ store_id:store.id, opened_by:sb._uid, initial_amount:+initVal, status:"open" }).select_after();
    if(data) setCashSession(Array.isArray(data)?data[0]:data);
  };
  const closeCash = async () => {
    if(!window.confirm("Fechar caixa?"))return;
    await q("cash_sessions").eq("id",cashSession.id).update({ status:"closed", closed_at:new Date().toISOString(), final_amount:totalSales });
    setCashSession(null);
  };

  const addExpense = async () => {
    if(!expForm.description||!expForm.amount)return;
    await q("expenses").insert({...expForm, amount:+expForm.amount, store_id:store.id});
    setShowExpense(false); setExpForm({description:"",category:"despesa",amount:"",expense_date:today()}); loadAll();
  };

  const totalSales    = sales.reduce((s,x)=>s+Number(x.total),0);
  const totalExpenses = expenses.reduce((s,x)=>s+Number(x.amount),0);
  const netProfit     = totalSales - totalExpenses;

  // últimos 7 dias para gráfico
  const [chart7, setChart7] = useState([]);
  useEffect(()=>{ loadChart7(); },[]);
  const loadChart7 = async () => {
    const days = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d.toISOString().split("T")[0]; });
    const results = await Promise.all(days.map(d=>q("sales").eq("store_id",store.id).gte("created_at",d+"T00:00:00").lte("created_at",d+"T23:59:59")));
    setChart7(days.map((d,i)=>({ day:new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"short"}), total:( results[i].data||[]).reduce((s,x)=>s+Number(x.total),0) })));
  };
  const maxChart = Math.max(...chart7.map(d=>d.total),1);

  return (
    <div style={S.module}>
      <div style={S.moduleHdr}>
        <h2 style={S.h2}>💰 Contabilidade</h2>
        <input type="date" style={{...S.input,width:"auto"}} value={period} onChange={e=>setPeriod(e.target.value)}/>
      </div>

      <div style={S.tabs}>
        {[["caixa","Caixa"],["vendas","Vendas"],["despesas","Despesas"],["relatorio","Relatório"]].map(([k,l])=>(
          <button key={k} style={{...S.tab,...(tab===k?S.tabActive:{})}} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {tab==="caixa"&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:12,marginBottom:16}}>
            {[["dollar","Receita do Dia",fmt(totalSales),"#4ade80"],["chart","Despesas",fmt(totalExpenses),"#f87171"],["check","Lucro Líquido",fmt(netProfit),netProfit>=0?"#4ade80":"#f87171"],["tag","Nº Vendas",sales.length,"#60a5fa"]].map(([ic,lb,vl,cl])=>(
              <div key={lb} style={{background:"#0d1b2a",border:"1px solid #1e293b",borderRadius:14,padding:18}}>
                <Ic n={ic} s={18} c={cl}/><div style={{fontSize:22,fontWeight:800,color:cl,marginTop:6}}>{vl}</div><div style={{fontSize:12,color:"#475569",marginTop:3}}>{lb}</div>
              </div>
            ))}
          </div>

          <div style={{background:"#0d1b2a",border:"1px solid #1e293b",borderRadius:14,padding:20,marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{fontWeight:700}}>Status do Caixa</div>
                <div style={{fontSize:13,color:cashSession?"#4ade80":"#f87171",marginTop:4}}>
                  {cashSession?`✅ Aberto — troco: ${fmt(cashSession.initial_amount)}`:"🔴 Fechado"}
                </div>
              </div>
              {!cashSession?(
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <input style={{...S.input,width:130}} type="number" placeholder="Troco inicial" value={initVal} onChange={e=>setInitVal(e.target.value)}/>
                  <Btn onClick={openCash}>Abrir Caixa</Btn>
                </div>
              ):(
                <Btn variant="danger" onClick={closeCash}>Fechar Caixa</Btn>
              )}
            </div>
          </div>
          <Btn variant="danger" onClick={()=>setShowExpense(true)}><Ic n="plus" s={14}/>Lançar Despesa</Btn>
        </div>
      )}

      {tab==="vendas"&&(
        <div style={S.table}>
          <div style={S.tableHd}><span>Hora</span><span>Cliente</span><span>Pagamento</span><span style={{textAlign:"right"}}>Total</span></div>
          {loading?<div style={{padding:24,textAlign:"center",color:"#475569"}}>Carregando…</div>:
           sales.length===0?<div style={{padding:24,textAlign:"center",color:"#475569"}}>Nenhuma venda neste período</div>:
           sales.map(s=>(
            <div key={s.id} style={S.tableRow}>
              <span style={{fontSize:12,color:"#475569"}}>{new Date(s.created_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</span>
              <span style={{fontSize:13}}>{s.customer_name}</span>
              <span style={{...S.catBadge,background:"#1e293b",color:"#94a3b8",fontSize:11}}>{s.payment}</span>
              <span style={{textAlign:"right",color:"#4ade80",fontWeight:700}}>{fmt(s.total)}</span>
              {onCancelSale&&s.status!=="cancelled"&&<button style={{...S.iconBtn,color:"#ef4444",fontSize:11,padding:"3px 8px",border:"1px solid #ef444444",borderRadius:6}} onClick={()=>onCancelSale(s)}>Cancelar</button>}
            </div>
          ))}
        </div>
      )}

      {tab==="despesas"&&(
        <div>
          <Btn variant="danger" onClick={()=>setShowExpense(true)} style={{marginBottom:12}}><Ic n="plus" s={14}/>Nova Despesa</Btn>
          <div style={S.table}>
            <div style={S.tableHd}><span>Data</span><span>Descrição</span><span>Categoria</span><span style={{textAlign:"right"}}>Valor</span></div>
            {expenses.length===0?<div style={{padding:24,textAlign:"center",color:"#475569"}}>Nenhuma despesa</div>:
             expenses.map(e=>(
              <div key={e.id} style={S.tableRow}>
                <span style={{fontSize:12,color:"#475569"}}>{e.expense_date}</span>
                <span style={{fontSize:13}}>{e.description}</span>
                <span style={{...S.catBadge,background:"#1e293b",color:"#94a3b8",fontSize:11}}>{e.category}</span>
                <span style={{textAlign:"right",color:"#f87171",fontWeight:700}}>{fmt(e.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab==="relatorio"&&(
        <div>
          <div style={{background:"#0d1b2a",border:"1px solid #1e293b",borderRadius:14,padding:20,marginBottom:16}}>
            <div style={{fontWeight:700,marginBottom:14}}>📊 Receita — Últimos 7 dias</div>
            <div style={{display:"flex",alignItems:"flex-end",gap:8,height:100}}>
              {chart7.map((d,i)=>(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  {d.total>0&&<div style={{fontSize:9,color:"#4ade80",fontWeight:700}}>{fmt(d.total).replace("R$\u00a0","")}</div>}
                  <div style={{width:"100%",background:"#4ade80",borderRadius:4,height:(d.total/maxChart)*80||3,minHeight:3,transition:"height .3s"}}/>
                  <div style={{fontSize:10,color:"#475569"}}>{d.day}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showExpense&&(
        <Modal title="Lançar Despesa" onClose={()=>setShowExpense(false)}>
          <Inp label="Descrição" placeholder="Ex: Aluguel, Energia…" value={expForm.description} onChange={e=>setExpForm(f=>({...f,description:e.target.value}))}/>
          <Sel label="Categoria" value={expForm.category} onChange={e=>setExpForm(f=>({...f,category:e.target.value}))}>
            {["aluguel","energia","agua","funcionario","fornecedor","transporte","manutenção","marketing","outros"].map(c=><option key={c}>{c}</option>)}
          </Sel>
          <Inp label="Data" type="date" value={expForm.expense_date} onChange={e=>setExpForm(f=>({...f,expense_date:e.target.value}))}/>
          <Inp label="Valor R$" type="number" step=".01" placeholder="0,00" value={expForm.amount} onChange={e=>setExpForm(f=>({...f,amount:e.target.value}))}/>
          <Btn full onClick={addExpense} disabled={!expForm.description||!expForm.amount}>Lançar</Btn>
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  CONFIGURAÇÕES DA LOJA
// ══════════════════════════════════════════════════════════════
function Config() {
  const { store, setStore } = useApp();
  const [form, setForm] = useState({ name:store.name||"", city:store.city||"", state:store.state||"CE", phone:store.phone||"", logo_emoji:store.logo_emoji||"🐾" });
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  const save = async () => {
    setSaving(true);
    const { data } = await q("stores").eq("id",store.id).update(form).select_after();
    if(data){ const s=Array.isArray(data)?data[0]:data; setStore(s); localStorage.setItem("pg_store",JSON.stringify(s)); setOk(true); setTimeout(()=>setOk(false),3000); }
    setSaving(false);
  };

  return (
    <div style={S.module}>
      <h2 style={S.h2}>⚙️ Configurações da Loja</h2>
      <div style={{maxWidth:480,marginTop:20}}>
        <div style={{background:"#0d1b2a",border:"1px solid #1e293b",borderRadius:16,padding:24}}>
          <div style={{fontSize:48,marginBottom:8}}>{form.logo_emoji}</div>
          <Inp label="Emoji da Loja" value={form.logo_emoji} onChange={e=>setForm(f=>({...f,logo_emoji:e.target.value}))} maxLength={2}/>
          <Inp label="Nome da Loja" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
          <Inp label="Telefone/WhatsApp" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:12}}>
            <Inp label="Cidade" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))}/>
            <Sel label="UF" value={form.state} onChange={e=>setForm(f=>({...f,state:e.target.value}))}>
              {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(s=><option key={s}>{s}</option>)}
            </Sel>
          </div>
          <div style={{marginTop:4,padding:"10px 14px",background:"#1e293b",borderRadius:10,fontSize:12,color:"#475569",marginBottom:16}}>
            Plano atual: <strong style={{color:"#4ade80"}}>{PLANS[store.plan]||"Gratuito"}</strong>
          </div>
          {ok&&<div style={{background:"rgba(74,222,128,.15)",border:"1px solid #4ade80",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#4ade80",marginBottom:12}}>✓ Salvo com sucesso!</div>}
          <Btn full onClick={save} disabled={saving}>{saving?"Salvando…":"Salvar Configurações"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  SHELL PRINCIPAL (pós-login) — v2 SaaS completo
// ══════════════════════════════════════════════════════════════
function Shell({ user }) {
  const [store, setStore] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [cashSession, setCashSession] = useState(null);
  const [tab, setTab] = useState("pdv");
  const [loading, setLoading] = useState(true);
  const [showImportCSV, setShowImportCSV] = useState(false);
  const [showMovimento, setShowMovimento] = useState(null); // product
  const [showCancelSale, setShowCancelSale] = useState(null); // sale

  // Detecta se é admin master (configure seu UID aqui)
  const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || "";
  const isAdmin = sb._uid === ADMIN_UID;

  useEffect(()=>{
    const cached = localStorage.getItem("pg_store");
    if(cached) { try { setStore(JSON.parse(cached)); } catch{} }
    loadStore();
  },[]);

  const loadStore = async () => {
    const { data } = await q("stores").eq("owner_id", sb._uid).limit(1);
    if(data&&data.length>0){
      setStore(data[0]);
      localStorage.setItem("pg_store",JSON.stringify(data[0]));
      const { data: cs } = await q("cash_sessions").eq("store_id",data[0].id).eq("status","open").limit(1);
      if(cs&&cs.length>0) setCashSession(cs[0]);
      // carrega assinatura
      const { data: sub } = await q("subscriptions").eq("store_id",data[0].id).order("created_at",{ascending:false}).limit(1);
      if(sub&&sub.length>0) setSubscription(sub[0]);
    }
    setLoading(false);
  };

  const logout = async () => { await sb.auth.signOut(); window.location.reload(); };

  if(loading) return <div style={{minHeight:"100vh",background:"#080f1a",display:"flex",alignItems:"center",justifyContent:"center",color:"#475569"}}>
    <div style={{textAlign:"center"}}><div style={{fontSize:48,marginBottom:12}}>🐾</div><div>Carregando…</div></div>
  </div>;

  if(!store) return <SetupStore userId={sb._uid} onDone={s=>{setStore(s);localStorage.setItem("pg_store",JSON.stringify(s));}}/>;

  const NAV_ITEMS = [
    ["pdv","🖥️","PDV"],
    ["estoque","📦","Estoque"],
    ["contabilidade","💰","Financeiro"],
    ["relatorio","📊","Relatório"],
    ["funcionarios","👥","Equipe"],
    ["planos","💳","Plano"],
    ["config","⚙️","Loja"],
    ...(isAdmin ? [["admin","👑","Admin"]] : []),
  ];

  // Dias restantes de trial
  const trialDaysLeft = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at) - new Date()) / 86400000))
    : null;

  return (
    <AppCtx.Provider value={{ store, setStore, cashSession, setCashSession, user, subscription }}>
      <div style={S.app}>
        <PWABanner />

        {/* TRIAL BANNER */}
        {trialDaysLeft !== null && trialDaysLeft <= 7 && store.plan === "free" && (
          <div style={{background:"rgba(167,139,250,.12)",borderBottom:"1px solid #a78bfa44",padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:13}}>
            <span style={{color:"#a78bfa"}}>⏳ Período gratuito termina em <strong>{trialDaysLeft} dia(s)</strong></span>
            <button style={{background:"#a78bfa",border:"none",borderRadius:8,padding:"5px 14px",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}} onClick={()=>setTab("planos")}>
              Assinar agora
            </button>
          </div>
        )}

        {/* TOP BAR */}
        <div style={S.topBar}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:26}}>{store.logo_emoji||"🐾"}</span>
            <div>
              <div style={{fontWeight:900,fontSize:15,color:"#fff"}}>{store.name}</div>
              <div style={{fontSize:11,color:"#334155"}}>{store.city} · Plano {PLANS[store.plan]||"Gratuito"}</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{textAlign:"right",fontSize:12}}>
              <div style={{color:cashSession?"#4ade80":"#f87171",fontWeight:700}}>{cashSession?"● Caixa Aberto":"● Caixa Fechado"}</div>
              <div style={{color:"#334155"}}>{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"short"})}</div>
            </div>
            <button style={{...S.iconBtn,color:"#475569"}} onClick={logout} title="Sair"><Ic n="logout" s={18}/></button>
          </div>
        </div>

        {/* NAV */}
        <div style={S.nav}>
          {NAV_ITEMS.map(([k,ic,lb])=>(
            <button key={k} style={{...S.navBtn,...(tab===k?S.navBtnActive:{})}} onClick={()=>setTab(k)}>
              <span>{ic}</span> {lb}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <PlanGate store={store} subscription={subscription} onUpgrade={()=>setTab("planos")}>
          <div style={S.content}>
            {tab==="pdv"&&<PDV/>}
            {tab==="estoque"&&(
              <EstoqueComExtras
                store={store}
                onImportCSV={()=>setShowImportCSV(true)}
                onMovimento={(p)=>setShowMovimento(p)}
              />
            )}
            {tab==="contabilidade"&&<Contabilidade onCancelSale={(s)=>setShowCancelSale(s)}/>}
            {tab==="relatorio"&&<Relatorio store={store} q={q}/>}
            {tab==="funcionarios"&&<Funcionarios store={store} q={q} SUPABASE_URL={SUPABASE_URL} SUPABASE_KEY={SUPABASE_KEY}/>}
            {tab==="planos"&&<Planos store={store} onUpgrade={()=>loadStore()}/>}
            {tab==="config"&&<Config/>}
            {tab==="admin"&&isAdmin&&<AdminMaster SUPABASE_URL={SUPABASE_URL} SERVICE_KEY={import.meta.env.VITE_SUPABASE_SERVICE_KEY||""}/>}
          </div>
        </PlanGate>
      </div>

      {/* MODAL: Importação CSV */}
      {showImportCSV&&(
        <div style={S.overlay} onClick={()=>setShowImportCSV(false)}>
          <div style={{...S.modal,maxWidth:640}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHdr}>
              <span style={{fontWeight:700}}>📂 Importar Produtos via CSV</span>
              <button style={S.iconBtn} onClick={()=>setShowImportCSV(false)}><Ic n="x"/></button>
            </div>
            <div style={{padding:"16px 22px 24px"}}>
              <ImportCSV store={store} q={q} onDone={()=>setShowImportCSV(false)}/>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Entrada/Ajuste de Estoque */}
      {showMovimento&&(
        <div style={S.overlay} onClick={()=>setShowMovimento(null)}>
          <div style={{...S.modal,maxWidth:480}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHdr}>
              <span style={{fontWeight:700}}>📦 Movimentação de Estoque</span>
              <button style={S.iconBtn} onClick={()=>setShowMovimento(null)}><Ic n="x"/></button>
            </div>
            <div style={{padding:"16px 22px 24px"}}>
              <EntradaEstoque product={showMovimento} store={store} q={q} onDone={()=>setShowMovimento(null)}/>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Cancelar Venda */}
      {showCancelSale&&(
        <div style={S.overlay} onClick={()=>setShowCancelSale(null)}>
          <div style={{...S.modal,maxWidth:480}} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHdr}>
              <span style={{fontWeight:700}}>🚫 Cancelar Venda</span>
              <button style={S.iconBtn} onClick={()=>setShowCancelSale(null)}><Ic n="x"/></button>
            </div>
            <div style={{padding:"16px 22px 24px"}}>
              <CancelSale sale={showCancelSale} store={store} q={q} onDone={()=>setShowCancelSale(null)}/>
            </div>
          </div>
        </div>
      )}
    </AppCtx.Provider>
  );
}

// ── Wrapper do Estoque com botões extras ──────────────────────
function EstoqueComExtras({ store, onImportCSV, onMovimento }) {
  return (
    <div>
      <div style={{display:"flex",gap:10,padding:"14px 20px 0",flexWrap:"wrap"}}>
        <button style={{padding:"8px 14px",border:"1px solid #334155",borderRadius:10,background:"#1e293b",color:"#94a3b8",fontWeight:700,fontSize:12,cursor:"pointer"}} onClick={onImportCSV}>
          📂 Importar CSV
        </button>
      </div>
      <EstoqueInner onMovimento={onMovimento}/>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  ROOT
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(()=>{
    const token = localStorage.getItem("pg_token");
    const uid   = localStorage.getItem("pg_uid");
    if(token && uid){
      sb._token = token; sb._uid = uid;
      // tenta refresh silencioso
      sb.auth.refresh().then(d => {
        if(d) setUser({ id: sb._uid });
        else { localStorage.removeItem("pg_token"); localStorage.removeItem("pg_uid"); }
        setChecking(false);
      });
    } else { setChecking(false); }
  },[]);

  if(checking) return <div style={{minHeight:"100vh",background:"#080f1a",display:"flex",alignItems:"center",justifyContent:"center"}}>
    <div style={{fontSize:48,animation:"pulse 1.5s infinite"}}>🐾</div>
  </div>;

  if(!user) return <AuthScreen onAuth={u=>{setUser(u);}}/>;
  return <Shell user={user}/>;
}

// ─── STYLES ──────────────────────────────────────────────────
const S = {
  app:      { background:"#080f1a", minHeight:"100vh", color:"#e2e8f0", fontFamily:"'Inter',system-ui,sans-serif" },
  topBar:   { background:"#0d1b2a", borderBottom:"1px solid #1e293b", padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" },
  nav:      { background:"#0d1b2a", borderBottom:"1px solid #1e293b", display:"flex", padding:"0 16px", gap:4, overflowX:"auto" },
  navBtn:   { padding:"11px 18px", background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:13, fontWeight:600, borderBottom:"2px solid transparent", whiteSpace:"nowrap" },
  navBtnActive: { color:"#4ade80", borderBottom:"2px solid #4ade80" },
  content:  { overflow:"auto" },

  // PDV
  pdvLayout: { display:"flex", height:"calc(100vh - 105px)", overflow:"hidden" },
  pdvLeft:   { flex:1, display:"flex", flexDirection:"column", overflow:"hidden", borderRight:"1px solid #1e293b" },
  pdvRight:  { width:350, display:"flex", flexDirection:"column", background:"#0d1b2a", flexShrink:0 },
  searchBar: { padding:"10px 14px", display:"flex", gap:8, borderBottom:"1px solid #1e293b", flexShrink:0 },
  searchWrap:{ flex:1, display:"flex", alignItems:"center", gap:8, background:"#1e293b", borderRadius:10, padding:"9px 13px", color:"#475569" },
  searchInput:{ flex:1, background:"none", border:"none", outline:"none", color:"#e2e8f0", fontSize:14 },
  filterRow: { display:"flex", gap:5, padding:"8px 14px", overflowX:"auto", borderBottom:"1px solid #1e293b", flexShrink:0 },
  filterBtn: { padding:"5px 12px", borderRadius:20, border:"1px solid #1e293b", background:"#1e293b", color:"#94a3b8", cursor:"pointer", fontSize:11, whiteSpace:"nowrap", fontWeight:600 },
  productGrid:{ flex:1, overflowY:"auto", padding:10, display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:8, alignContent:"start" },
  productCard:{ background:"#0d1b2a", border:"1px solid #1e293b", borderRadius:12, padding:"12px 10px", cursor:"pointer", textAlign:"left", position:"relative", transition:"border-color .15s", display:"flex", flexDirection:"column", gap:3 },
  productCardOOS:{ opacity:.4, cursor:"not-allowed" },
  productName:{ fontSize:12, fontWeight:600, color:"#e2e8f0", lineHeight:1.3 },
  productPrice:{ fontSize:15, fontWeight:800, color:"#4ade80" },
  lowBadge:  { position:"absolute", top:5, right:5, background:"#f59e0b22", color:"#f59e0b", fontSize:9, padding:"1px 5px", borderRadius:5, display:"flex", alignItems:"center", gap:2, fontWeight:700 },
  cartHdr:   { padding:"12px 14px", borderBottom:"1px solid #1e293b", display:"flex", alignItems:"center", gap:8, flexShrink:0 },
  cartItems: { flex:1, overflowY:"auto", padding:"6px 14px" },
  cartItem:  { display:"flex", alignItems:"center", gap:8, padding:"8px 0", borderBottom:"1px solid #0f172a" },
  cartFooter:{ padding:"10px 14px", borderTop:"1px solid #1e293b", flexShrink:0 },
  totalRow:  { display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:13, marginBottom:6 },
  qtyBtn:    { width:22, height:22, borderRadius:5, border:"1px solid #1e293b", background:"#1e293b", color:"#e2e8f0", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },
  payBtn:    { flex:1, padding:"7px 3px", borderRadius:7, border:"1px solid #1e293b", background:"#1e293b", color:"#94a3b8", cursor:"pointer", fontSize:10, fontWeight:600, whiteSpace:"nowrap" },
  btn:       { display:"flex", alignItems:"center", gap:6, padding:"10px 16px", border:"none", borderRadius:10, cursor:"pointer", fontSize:13, fontWeight:700, color:"#e2e8f0" },

  // Modules
  module:    { padding:20, maxWidth:1200 },
  moduleHdr: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 },
  h2:        { margin:0, fontSize:20, fontWeight:800 },
  table:     { background:"#0d1b2a", borderRadius:12, overflow:"hidden", border:"1px solid #1e293b" },
  tableHd:   { display:"flex", gap:12, padding:"10px 14px", background:"#0f172a", fontSize:11, color:"#334155", fontWeight:700, textTransform:"uppercase", letterSpacing:".05em" },
  tableRow:  { display:"flex", gap:12, padding:"10px 14px", borderTop:"1px solid #0f172a", alignItems:"center" },
  alertBanner:{ background:"rgba(245,158,11,.1)", border:"1px solid #f59e0b44", borderRadius:10, padding:"10px 14px", marginBottom:14, display:"flex", gap:8, alignItems:"center", fontSize:13, color:"#f59e0b" },
  tabs:      { display:"flex", gap:0, marginBottom:16, borderBottom:"1px solid #1e293b" },
  tab:       { padding:"9px 16px", background:"none", border:"none", color:"#475569", cursor:"pointer", fontSize:13, fontWeight:600, borderBottom:"2px solid transparent" },
  tabActive: { color:"#4ade80", borderBottom:"2px solid #4ade80" },
  catBadge:  { display:"inline-block", padding:"2px 7px", borderRadius:5, fontWeight:700 },

  // Modal
  overlay:   { position:"fixed", inset:0, background:"rgba(0,0,0,.75)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, backdropFilter:"blur(4px)" },
  modal:     { background:"#0d1b2a", border:"1px solid #1e293b", borderRadius:18, width:"92%", maxHeight:"90vh", overflowY:"auto" },
  modalHdr:  { padding:"14px 20px", borderBottom:"1px solid #1e293b", display:"flex", alignItems:"center", justifyContent:"space-between" },

  // Form
  input:     { width:"100%", background:"#1e293b", border:"1px solid #334155", borderRadius:8, padding:"10px 12px", color:"#e2e8f0", fontSize:13, outline:"none", boxSizing:"border-box" },
  label:     { display:"block", fontSize:11, fontWeight:700, color:"#475569", marginBottom:4, textTransform:"uppercase", letterSpacing:".05em" },
  iconBtn:   { background:"none", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:6, borderRadius:7, color:"#475569" },
};
