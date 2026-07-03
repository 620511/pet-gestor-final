// ═══════════════════════════════════════════════════════════════
//  PET GESTOR — Módulos SaaS v2
//  Arquivo: src/modules.jsx
//  Inclui: Planos, Cobrança Asaas, Admin Master, Funcionários,
//          Importação CSV, Entrada de Estoque, Cancelamento,
//          Relatório por período, Recuperação de senha
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Re-exporta helpers do App principal ─────────────────────
// (em produção esses vêm de src/lib/supabase.js e src/lib/utils.js)
// Aqui assumimos que q(), sb, fmt, S, Btn, Inp, Sel, Modal, Ic
// estão disponíveis no escopo global do App.jsx que importa este arquivo.

// ══════════════════════════════════════════════════════════════
//  1. RECUPERAÇÃO DE SENHA
// ══════════════════════════════════════════════════════════════
export function ForgotPassword({ onBack, SUPABASE_URL, SUPABASE_KEY }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const send = async () => {
    if (!email) return;
    setLoading(true); setErr("");
    const r = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
      body: JSON.stringify({ email }),
    });
    if (r.ok) setSent(true);
    else setErr("Não foi possível enviar o e-mail. Verifique o endereço.");
    setLoading(false);
  };

  if (sent) return (
    <div style={{ textAlign: "center", padding: 32 }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
      <h3 style={{ color: "#fff", marginBottom: 8 }}>E-mail enviado!</h3>
      <p style={{ color: "#475569", fontSize: 14, marginBottom: 24 }}>
        Verifique sua caixa de entrada e siga o link para redefinir sua senha.
      </p>
      <button style={{ background: "none", border: "none", color: "#4ade80", cursor: "pointer", fontWeight: 700 }} onClick={onBack}>
        ← Voltar ao login
      </button>
    </div>
  );

  return (
    <div style={{ padding: "8px 0" }}>
      <p style={{ color: "#475569", fontSize: 13, marginBottom: 20 }}>
        Informe seu e-mail e enviaremos um link para redefinir a senha.
      </p>
      {err && <div style={{ background: "#ef444422", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#f87171", marginBottom: 14 }}>{err}</div>}
      <div style={{ marginBottom: 14 }}>
        <label style={forgotS.label}>E-mail</label>
        <input style={forgotS.input} type="email" placeholder="seu@email.com"
          value={email} onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button style={{ ...forgotS.btn, background: "#1e293b", flex: 1 }} onClick={onBack}>Cancelar</button>
        <button style={{ ...forgotS.btn, background: "#4ade80", color: "#000", flex: 2 }} onClick={send} disabled={loading}>
          {loading ? "Enviando…" : "Enviar link"}
        </button>
      </div>
    </div>
  );
}

const forgotS = {
  label: { display: "block", fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 4, textTransform: "uppercase" },
  input: { width: "100%", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, padding: "10px 12px", color: "#e2e8f0", fontSize: 13, outline: "none", boxSizing: "border-box" },
  btn:   { display: "flex", alignItems: "center", justifyContent: "center", padding: "11px 0", border: "none", borderRadius: 10, cursor: "pointer", fontWeight: 700, fontSize: 14 },
};

// ══════════════════════════════════════════════════════════════
//  2. PLANOS & COBRANÇA (Asaas PIX)
// ══════════════════════════════════════════════════════════════
const PLAN_CONFIG = {
  free:    { name: "Gratuito",  price: 0,   color: "#475569", features: ["100 produtos", "500 vendas/mês", "1 usuário", "Suporte por e-mail"] },
  pro:     { name: "Pro",       price: 4900, color: "#4ade80", features: ["Produtos ilimitados", "Vendas ilimitadas", "3 usuários", "Relatórios avançados", "Suporte prioritário"] },
  premium: { name: "Premium",   price: 9900, color: "#a78bfa", features: ["Tudo do Pro", "10 usuários", "Multi-loja", "Export PDF/Excel", "Suporte WhatsApp"] },
};

export function Planos({ store, onUpgrade }) {
  const [loading, setLoading] = useState(false);
  const [pix, setPix] = useState(null);   // { qrcode, copiaEcola, expiresAt }
  const [selectedPlan, setSelectedPlan] = useState(null);

  const handleUpgrade = async (plan) => {
    if (plan === "free") return;
    setLoading(true); setSelectedPlan(plan);

    // Em produção: chama seu backend/edge function que cria cobrança no Asaas
    // Aqui simulamos o retorno com um QR code de exemplo
    // INTEGRAÇÃO REAL: POST /api/asaas/create-subscription
    const payload = {
      storeId: store.id,
      plan,
      email: store.owner_email || "cliente@petgestor.com",
      name: store.name,
      price: PLAN_CONFIG[plan].price,
    };

    // Simula chamada ao backend (substitua pela sua edge function)
    await new Promise(r => setTimeout(r, 1200));
    setPix({
      plan,
      copiaEcola: "00020126580014BR.GOV.BCB.PIX0136petgestor@asaas.com5204000053039865802BR5925Pet Gestor Sistemas6009SAO PAULO62070503***6304ABCD",
      valor: PLAN_CONFIG[plan].price / 100,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toLocaleTimeString("pt-BR"),
    });
    setLoading(false);
  };

  const copyPix = () => {
    if (!pix) return;
    navigator.clipboard.writeText(pix.copiaEcola);
    alert("Código PIX copiado! Cole no seu banco.");
  };

  const currentPlan = store.plan || "free";

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>💳 Planos & Assinatura</h2>
      <p style={{ color: "#475569", fontSize: 13, marginBottom: 24 }}>
        Plano atual: <strong style={{ color: PLAN_CONFIG[currentPlan]?.color }}>{PLAN_CONFIG[currentPlan]?.name}</strong>
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, marginBottom: 24 }}>
        {Object.entries(PLAN_CONFIG).map(([key, plan]) => {
          const isCurrent = key === currentPlan;
          return (
            <div key={key} style={{
              background: "#0d1b2a", border: `2px solid ${isCurrent ? plan.color : "#1e293b"}`,
              borderRadius: 16, padding: 24, position: "relative",
            }}>
              {isCurrent && (
                <div style={{ position: "absolute", top: 12, right: 12, background: plan.color, color: "#000", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>
                  ATUAL
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: plan.color, marginBottom: 4 }}>{plan.name}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", marginBottom: 2 }}>
                {plan.price === 0 ? "Grátis" : `R$\u00a0${(plan.price / 100).toFixed(2).replace(".", ",")}`}
              </div>
              {plan.price > 0 && <div style={{ fontSize: 11, color: "#475569", marginBottom: 16 }}>/mês · cobrado via PIX</div>}
              <ul style={{ listStyle: "none", padding: 0, margin: "16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#94a3b8" }}>
                    <span style={{ color: plan.color, fontSize: 16 }}>✓</span> {f}
                  </li>
                ))}
              </ul>
              {!isCurrent && key !== "free" && (
                <button
                  style={{ width: "100%", padding: "11px 0", border: "none", borderRadius: 10, background: plan.color, color: "#000", fontWeight: 700, fontSize: 14, cursor: loading && selectedPlan === key ? "wait" : "pointer" }}
                  onClick={() => handleUpgrade(key)}
                  disabled={loading && selectedPlan === key}
                >
                  {loading && selectedPlan === key ? "Gerando PIX…" : `Assinar ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {pix && (
        <div style={{ background: "#0d1b2a", border: "1px solid #4ade80", borderRadius: 16, padding: 24, maxWidth: 480 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>✅ PIX gerado — Plano {PLAN_CONFIG[pix.plan]?.name}</div>
          <div style={{ color: "#475569", fontSize: 13, marginBottom: 16 }}>Válido até {pix.expiresAt} · R$ {pix.valor.toFixed(2).replace(".", ",")}</div>
          <div style={{ background: "#1e293b", borderRadius: 10, padding: "12px 14px", fontSize: 11, fontFamily: "monospace", wordBreak: "break-all", color: "#94a3b8", marginBottom: 14 }}>
            {pix.copiaEcola}
          </div>
          <button
            style={{ width: "100%", padding: 12, border: "none", borderRadius: 10, background: "#4ade80", color: "#000", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
            onClick={copyPix}
          >
            📋 Copiar código PIX
          </button>
          <p style={{ fontSize: 12, color: "#334155", marginTop: 12, textAlign: "center" }}>
            Após o pagamento confirmado, seu plano é atualizado automaticamente em até 5 minutos.
          </p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  3. BLOQUEIO POR PLANO — wrapper que verifica limites
// ══════════════════════════════════════════════════════════════
export function PlanGate({ store, subscription, children, onUpgrade }) {
  if (!subscription) return children;

  const isExpired = subscription.current_period_end &&
    new Date(subscription.current_period_end) < new Date() &&
    subscription.plan === "free";

  if (isExpired) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: 20 }}>
      <div style={{ background: "#0d1b2a", border: "2px solid #f59e0b", borderRadius: 20, padding: 40, maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
        <h3 style={{ color: "#f59e0b", marginBottom: 8 }}>Período de teste encerrado</h3>
        <p style={{ color: "#475569", fontSize: 14, marginBottom: 24 }}>
          Seu período gratuito de 14 dias terminou. Assine um plano para continuar usando o Pet Gestor.
        </p>
        <button style={{ width: "100%", padding: 14, border: "none", borderRadius: 12, background: "#4ade80", color: "#000", fontWeight: 700, fontSize: 15, cursor: "pointer" }} onClick={onUpgrade}>
          Ver planos e assinar →
        </button>
      </div>
    </div>
  );

  return children;
}

// ══════════════════════════════════════════════════════════════
//  4. IMPORTAÇÃO CSV DE PRODUTOS
// ══════════════════════════════════════════════════════════════
export function ImportCSV({ store, onDone, q }) {
  const [rows, setRows] = useState([]);
  const [preview, setPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const fileRef = useRef();

  const EXPECTED_COLS = ["nome", "categoria", "preco", "custo", "estoque", "estoque_minimo", "unidade", "codigo_barras", "emoji"];

  const parseCSV = (text) => {
    const lines = text.trim().split("\n");
    const headers = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/"/g, ""));
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/"/g, ""));
      const obj = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
      return obj;
    }).filter(r => r.nome);
  };

  const handleFile = (e) => {
    setErr(""); setResult(null); setRows([]);
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) { setErr("Envie um arquivo .csv"); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCSV(ev.target.result);
        if (!parsed.length) { setErr("Arquivo vazio ou formato inválido"); return; }
        setRows(parsed); setPreview(true);
      } catch { setErr("Erro ao ler o arquivo. Verifique o formato."); }
    };
    reader.readAsText(file, "UTF-8");
  };

  const doImport = async () => {
    setImporting(true);
    const products = rows.map(r => ({
      store_id: store.id,
      name: r.nome || r.name || "",
      category: r.categoria || r.category || "racao",
      species: r.especie || r.species || "todos",
      price: parseFloat(r.preco || r.price || 0),
      cost: parseFloat(r.custo || r.cost || 0),
      stock: parseFloat(r.estoque || r.stock || 0),
      min_stock: parseFloat(r.estoque_minimo || r.min_stock || 5),
      unit: r.unidade || r.unit || "un",
      barcode: r.codigo_barras || r.barcode || "",
      emoji: r.emoji || "📦",
      active: true,
    }));

    // Insere em lotes de 50
    let success = 0, errors = 0;
    for (let i = 0; i < products.length; i += 50) {
      const batch = products.slice(i, i + 50);
      const { error } = await q("products").insert(batch);
      if (error) errors += batch.length;
      else success += batch.length;
    }
    setResult({ success, errors });
    setImporting(false);
    if (success > 0) setTimeout(onDone, 2000);
  };

  return (
    <div style={{ padding: "0 0 16px" }}>
      {!preview && !result && (
        <>
          <p style={{ color: "#475569", fontSize: 13, marginBottom: 16 }}>
            Importe sua lista de produtos via arquivo CSV. Baixe o modelo abaixo.
          </p>

          {/* Modelo para download */}
          <a
            href={`data:text/csv;charset=utf-8,nome,categoria,especie,preco,custo,estoque,estoque_minimo,unidade,codigo_barras,emoji\nRação Golden 15kg,racao,cao,189.90,110.00,24,5,un,7891234560001,🐕\nAreia Higiênica 4kg,higiene,gato,29.90,15.00,30,8,un,7891234560002,🐈`}
            download="modelo_produtos_petgestor.csv"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#94a3b8", fontSize: 12, fontWeight: 700, textDecoration: "none", marginBottom: 20 }}
          >
            📄 Baixar modelo CSV
          </a>

          {err && <div style={{ background: "#ef444422", border: "1px solid #ef4444", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#f87171", marginBottom: 14 }}>{err}</div>}

          <div
            style={{ border: "2px dashed #334155", borderRadius: 14, padding: 40, textAlign: "center", cursor: "pointer" }}
            onClick={() => fileRef.current?.click()}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
            <div style={{ color: "#475569", fontSize: 14 }}>Clique para selecionar o arquivo CSV</div>
            <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFile} />
          </div>
        </>
      )}

      {preview && !result && (
        <>
          <div style={{ marginBottom: 14, padding: "10px 14px", background: "#1e293b", borderRadius: 10, fontSize: 13, color: "#94a3b8" }}>
            <strong style={{ color: "#4ade80" }}>{rows.length} produtos</strong> encontrados no arquivo. Confira abaixo:
          </div>
          <div style={{ maxHeight: 280, overflowY: "auto", border: "1px solid #1e293b", borderRadius: 10, marginBottom: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#0f172a" }}>
                  {["Nome", "Categoria", "Preço", "Estoque", "Unid."].map(h => (
                    <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "#475569", fontWeight: 700 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #0f172a" }}>
                    <td style={{ padding: "7px 10px", color: "#e2e8f0" }}>{r.nome || r.name}</td>
                    <td style={{ padding: "7px 10px", color: "#94a3b8" }}>{r.categoria || r.category}</td>
                    <td style={{ padding: "7px 10px", color: "#4ade80" }}>R$ {r.preco || r.price}</td>
                    <td style={{ padding: "7px 10px", color: "#94a3b8" }}>{r.estoque || r.stock}</td>
                    <td style={{ padding: "7px 10px", color: "#94a3b8" }}>{r.unidade || r.unit}</td>
                  </tr>
                ))}
                {rows.length > 100 && (
                  <tr><td colSpan={5} style={{ padding: "8px 10px", color: "#475569", textAlign: "center" }}>... e mais {rows.length - 100} produtos</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={{ flex: 1, padding: 12, border: "1px solid #334155", borderRadius: 10, background: "#1e293b", color: "#e2e8f0", fontWeight: 700, cursor: "pointer" }} onClick={() => setPreview(false)}>
              Cancelar
            </button>
            <button style={{ flex: 2, padding: 12, border: "none", borderRadius: 10, background: "#4ade80", color: "#000", fontWeight: 700, cursor: "pointer" }} onClick={doImport} disabled={importing}>
              {importing ? `Importando…` : `✓ Importar ${rows.length} produtos`}
            </button>
          </div>
        </>
      )}

      {result && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{result.errors === 0 ? "✅" : "⚠️"}</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
            {result.success} produto(s) importado(s) com sucesso
          </div>
          {result.errors > 0 && <div style={{ color: "#f87171", fontSize: 13 }}>{result.errors} erro(s) — verifique o CSV</div>}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  5. ENTRADA MANUAL DE ESTOQUE
// ══════════════════════════════════════════════════════════════
export function EntradaEstoque({ product, store, onDone, q }) {
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState(String(product.cost || ""));
  const [note, setNote] = useState("");
  const [type, setType] = useState("entry");  // entry | adjustment | loss
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!qty || isNaN(qty)) return;
    setSaving(true);
    const amount = parseFloat(qty);
    const newStock = type === "entry"
      ? product.stock + amount
      : type === "adjustment"
        ? amount
        : product.stock - amount;

    await q("products").eq("id", product.id).update({
      stock: Math.max(0, newStock),
      cost: cost ? parseFloat(cost) : product.cost,
      updated_at: new Date().toISOString(),
    });

    await q("stock_movements").insert({
      store_id: store.id,
      product_id: product.id,
      type,
      qty: type === "adjustment" ? amount - product.stock : amount,
      qty_before: product.stock,
      qty_after: Math.max(0, newStock),
      cost: cost ? parseFloat(cost) : product.cost,
      note,
    });

    setSaving(false);
    onDone();
  };

  const TYPES = [
    { key: "entry",      label: "✅ Entrada",      desc: "Compra/recebimento de mercadoria" },
    { key: "adjustment", label: "🔧 Ajuste",        desc: "Corrigir quantidade (inventário)" },
    { key: "loss",       label: "❌ Perda/Avaria",  desc: "Produto danificado ou vencido" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: 14, color: "#94a3b8" }}>
        <span style={{ fontSize: 20 }}>{product.emoji}</span> {product.name}
        <span style={{ marginLeft: 10, color: "#475569" }}>Estoque atual: <strong style={{ color: "#e2e8f0" }}>{product.stock} {product.unit}</strong></span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {TYPES.map(t => (
          <button key={t.key}
            style={{ flex: 1, padding: "10px 8px", border: `1px solid ${type === t.key ? "#4ade80" : "#1e293b"}`, borderRadius: 10, background: type === t.key ? "rgba(74,222,128,.1)" : "#1e293b", color: type === t.key ? "#4ade80" : "#475569", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
            onClick={() => setType(t.key)}
            title={t.desc}
          >{t.label}</button>
        ))}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={forgotS.label}>{type === "adjustment" ? "Novo estoque total" : "Quantidade"} ({product.unit})</label>
        <input style={{ ...forgotS.input, fontSize: 20, fontWeight: 700 }} type="number" step="0.001" min="0" placeholder="0" value={qty} onChange={e => setQty(e.target.value)} />
      </div>

      {type === "entry" && (
        <div style={{ marginBottom: 12 }}>
          <label style={forgotS.label}>Custo unitário (R$)</label>
          <input style={forgotS.input} type="number" step="0.01" placeholder={product.cost} value={cost} onChange={e => setCost(e.target.value)} />
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={forgotS.label}>Observação (opcional)</label>
        <input style={forgotS.input} placeholder="Ex: NF 1234, Compra fornecedor X" value={note} onChange={e => setNote(e.target.value)} />
      </div>

      {qty && (
        <div style={{ background: "rgba(74,222,128,.1)", border: "1px solid #4ade80", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 13 }}>
          Estoque após: <strong style={{ color: "#4ade80" }}>
            {type === "entry" ? product.stock + parseFloat(qty || 0) :
             type === "adjustment" ? parseFloat(qty || 0) :
             Math.max(0, product.stock - parseFloat(qty || 0))} {product.unit}
          </strong>
        </div>
      )}

      <button style={{ width: "100%", padding: 12, border: "none", borderRadius: 10, background: "#4ade80", color: "#000", fontWeight: 700, fontSize: 14, cursor: saving ? "wait" : "pointer" }}
        onClick={save} disabled={saving || !qty}>
        {saving ? "Salvando…" : "Confirmar"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  6. CANCELAMENTO DE VENDA
// ══════════════════════════════════════════════════════════════
export function CancelSale({ sale, store, onDone, q }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const cancel = async () => {
    if (!reason.trim()) { alert("Informe o motivo do cancelamento"); return; }
    setSaving(true);

    // 1. Marca venda como cancelada
    await q("sales").eq("id", sale.id).update({ status: "cancelled" });

    // 2. Busca itens e devolve ao estoque
    const { data: items } = await q("sale_items").eq("sale_id", sale.id);
    if (items?.length) {
      for (const item of items) {
        if (!item.product_id) continue;
        const { data: prod } = await q("products").eq("id", item.product_id).single();
        if (!prod) continue;
        const newStock = prod.stock + item.qty;
        await q("products").eq("id", item.product_id).update({ stock: newStock, updated_at: new Date().toISOString() });
        await q("stock_movements").insert({
          store_id: store.id, product_id: item.product_id,
          type: "entry", qty: item.qty, qty_before: prod.stock, qty_after: newStock,
          note: `Cancelamento da venda #${sale.id.slice(0, 8)}. Motivo: ${reason}`,
        });
      }
    }

    setSaving(false);
    onDone();
  };

  return (
    <div>
      <div style={{ background: "rgba(239,68,68,.1)", border: "1px solid #ef4444", borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13 }}>
        ⚠️ O estoque dos produtos será <strong>devolvido automaticamente</strong>. Esta ação não pode ser desfeita.
      </div>
      <div style={{ marginBottom: 8, fontSize: 13, color: "#94a3b8" }}>
        Venda de <strong style={{ color: "#fff" }}>R$ {Number(sale.total).toFixed(2).replace(".", ",")}</strong> · {new Date(sale.created_at).toLocaleString("pt-BR")}
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={forgotS.label}>Motivo do cancelamento *</label>
        <input style={forgotS.input} placeholder="Ex: Troca, erro no pedido, desistência…" value={reason} onChange={e => setReason(e.target.value)} />
      </div>
      <button style={{ width: "100%", padding: 12, border: "none", borderRadius: 10, background: "#ef4444", color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "wait" : "pointer" }}
        onClick={cancel} disabled={saving || !reason.trim()}>
        {saving ? "Cancelando…" : "Confirmar Cancelamento"}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  7. RELATÓRIO POR PERÍODO CUSTOMIZADO
// ══════════════════════════════════════════════════════════════
export function Relatorio({ store, q }) {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [to, setTo] = useState(new Date().toISOString().split("T")[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fmt = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const load = async () => {
    setLoading(true);
    const [salesRes, expRes, itemsRes] = await Promise.all([
      q("sales").eq("store_id", store.id).eq("status", "completed")
        .gte("created_at", from + "T00:00:00").lte("created_at", to + "T23:59:59")
        .order("created_at", { ascending: false }),
      q("expenses").eq("store_id", store.id)
        .gte("expense_date", from).lte("expense_date", to),
      q("sale_items").select("*"),
    ]);

    const sales    = salesRes.data || [];
    const expenses = expRes.data || [];
    const revenue  = sales.reduce((s, x) => s + Number(x.total), 0);
    const totalExp = expenses.reduce((s, x) => s + Number(x.amount), 0);

    // por forma de pagamento
    const byPayment = {};
    sales.forEach(s => { byPayment[s.payment] = (byPayment[s.payment] || 0) + Number(s.total); });

    // por dia
    const byDay = {};
    sales.forEach(s => {
      const d = s.created_at.split("T")[0];
      byDay[d] = (byDay[d] || 0) + Number(s.total);
    });

    // por categoria de despesa
    const byExpCat = {};
    expenses.forEach(e => { byExpCat[e.category] = (byExpCat[e.category] || 0) + Number(e.amount); });

    setData({ sales, expenses, revenue, totalExp, netProfit: revenue - totalExp, byPayment, byDay, byExpCat });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const exportCSV = () => {
    if (!data) return;
    const rows = [
      ["Data", "Cliente", "Pagamento", "Total", "Status"],
      ...data.sales.map(s => [
        new Date(s.created_at).toLocaleDateString("pt-BR"),
        s.customer_name, s.payment,
        Number(s.total).toFixed(2).replace(".", ","),
        s.status,
      ])
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `vendas_${from}_${to}.csv`;
    a.click();
  };

  return (
    <div style={{ padding: 20, maxWidth: 1100 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <label style={forgotS.label}>De</label>
          <input type="date" style={{ ...forgotS.input, width: 160 }} value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label style={forgotS.label}>Até</label>
          <input type="date" style={{ ...forgotS.input, width: 160 }} value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <button style={{ padding: "10px 20px", border: "none", borderRadius: 10, background: "#4ade80", color: "#000", fontWeight: 700, cursor: "pointer" }} onClick={load} disabled={loading}>
          {loading ? "Carregando…" : "Gerar Relatório"}
        </button>
        {data && (
          <button style={{ padding: "10px 16px", border: "1px solid #334155", borderRadius: 10, background: "#1e293b", color: "#94a3b8", fontWeight: 700, cursor: "pointer", fontSize: 13 }} onClick={exportCSV}>
            📥 Exportar CSV
          </button>
        )}
      </div>

      {data && (
        <>
          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
            {[
              ["💰", "Receita Total", fmt(data.revenue), "#4ade80"],
              ["📉", "Despesas", fmt(data.totalExp), "#f87171"],
              ["📈", "Lucro Líquido", fmt(data.netProfit), data.netProfit >= 0 ? "#4ade80" : "#f87171"],
              ["🧾", "Nº de Vendas", data.sales.length, "#60a5fa"],
              ["💵", "Ticket Médio", fmt(data.sales.length ? data.revenue / data.sales.length : 0), "#f59e0b"],
            ].map(([ic, lb, vl, cl]) => (
              <div key={lb} style={{ background: "#0d1b2a", border: "1px solid #1e293b", borderRadius: 14, padding: 18 }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>{ic}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: cl }}>{vl}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>{lb}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            {/* Por forma de pagamento */}
            <div style={{ background: "#0d1b2a", border: "1px solid #1e293b", borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 14 }}>💳 Por Forma de Pagamento</div>
              {Object.entries(data.byPayment).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                    <span style={{ color: "#e2e8f0" }}>{k}</span>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>{fmt(v)}</span>
                  </div>
                  <div style={{ background: "#1e293b", borderRadius: 4, height: 6 }}>
                    <div style={{ background: "#4ade80", borderRadius: 4, height: 6, width: `${(v / data.revenue) * 100}%`, transition: "width .4s" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Por categoria de despesa */}
            <div style={{ background: "#0d1b2a", border: "1px solid #1e293b", borderRadius: 14, padding: 20 }}>
              <div style={{ fontWeight: 700, marginBottom: 14 }}>📂 Despesas por Categoria</div>
              {Object.entries(data.byExpCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                  <span style={{ color: "#94a3b8", textTransform: "capitalize" }}>{k}</span>
                  <span style={{ color: "#f87171", fontWeight: 700 }}>{fmt(v)}</span>
                </div>
              ))}
              {!Object.keys(data.byExpCat).length && <div style={{ color: "#334155", fontSize: 13 }}>Nenhuma despesa no período</div>}
            </div>
          </div>

          {/* Tabela de vendas */}
          <div style={{ background: "#0d1b2a", border: "1px solid #1e293b", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #1e293b", fontWeight: 700 }}>
              🧾 Vendas do Período ({data.sales.length})
            </div>
            <div style={{ maxHeight: 360, overflowY: "auto" }}>
              {data.sales.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#475569" }}>Nenhuma venda no período</div>}
              {data.sales.map(s => (
                <div key={s.id} style={{ display: "flex", gap: 12, padding: "10px 18px", borderTop: "1px solid #0f172a", alignItems: "center", fontSize: 13 }}>
                  <span style={{ color: "#475569", fontSize: 11, width: 130, flexShrink: 0 }}>{new Date(s.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  <span style={{ flex: 1, color: "#e2e8f0" }}>{s.customer_name}</span>
                  <span style={{ background: "#1e293b", color: "#94a3b8", fontSize: 11, padding: "2px 8px", borderRadius: 5, fontWeight: 700 }}>{s.payment}</span>
                  <span style={{ color: s.status === "cancelled" ? "#f87171" : "#4ade80", fontWeight: 700, minWidth: 90, textAlign: "right" }}>
                    {s.status === "cancelled" ? "CANCELADA" : fmt(s.total)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  8. GERENCIAR FUNCIONÁRIOS
// ══════════════════════════════════════════════════════════════
export function Funcionarios({ store, q, SUPABASE_URL, SUPABASE_KEY }) {
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("operator");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  const load = async () => {
    const [u, i] = await Promise.all([
      q("store_users").eq("store_id", store.id).eq("active", true),
      q("invites").eq("store_id", store.id).eq("accepted", false),
    ]);
    setUsers(u.data || []); setInvites(i.data || []);
    setLoading(false);
  };

  const sendInvite = async () => {
    if (!email.trim()) return;
    setSending(true);
    await q("invites").insert({ store_id: store.id, email, role });
    // Em produção: chama edge function que envia e-mail com o link do convite
    setEmail(""); setShowInvite(false);
    load();
    setSending(false);
    alert(`Convite gerado para ${email}. Em produção, o e-mail seria enviado automaticamente.`);
  };

  const ROLE_LABELS = { owner: "Dono", manager: "Gerente", operator: "Operador" };
  const ROLE_COLORS = { owner: "#a78bfa", manager: "#60a5fa", operator: "#94a3b8" };

  return (
    <div style={{ padding: 20, maxWidth: 700 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>👥 Funcionários</h2>
        <button style={{ padding: "10px 16px", border: "none", borderRadius: 10, background: "#4ade80", color: "#000", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
          onClick={() => setShowInvite(true)}>
          + Convidar funcionário
        </button>
      </div>

      {loading ? <div style={{ color: "#475569" }}>Carregando…</div> : (
        <>
          <div style={{ background: "#0d1b2a", border: "1px solid #1e293b", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "10px 16px", background: "#0f172a", fontSize: 11, color: "#334155", fontWeight: 700, textTransform: "uppercase" }}>
              Usuários ativos
            </div>
            {users.map(u => (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid #0f172a" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                  👤
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#e2e8f0" }}>{u.name || u.user_id?.slice(0, 8) + "…"}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>ID: {u.user_id?.slice(0, 12)}…</div>
                </div>
                <span style={{ background: ROLE_COLORS[u.role] + "22", color: ROLE_COLORS[u.role], fontSize: 11, padding: "2px 10px", borderRadius: 10, fontWeight: 700 }}>
                  {ROLE_LABELS[u.role] || u.role}
                </span>
              </div>
            ))}
          </div>

          {invites.length > 0 && (
            <div style={{ background: "#0d1b2a", border: "1px solid #1e293b", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "10px 16px", background: "#0f172a", fontSize: 11, color: "#334155", fontWeight: 700, textTransform: "uppercase" }}>
                Convites pendentes
              </div>
              {invites.map(inv => (
                <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid #0f172a" }}>
                  <span style={{ fontSize: 20 }}>✉️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#e2e8f0" }}>{inv.email}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>Expira em {new Date(inv.expires_at).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <span style={{ background: "#f59e0b22", color: "#f59e0b", fontSize: 11, padding: "2px 10px", borderRadius: 10, fontWeight: 700 }}>Pendente</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showInvite && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#0d1b2a", border: "1px solid #1e293b", borderRadius: 18, width: "90%", maxWidth: 420, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Convidar Funcionário</span>
              <button style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 20 }} onClick={() => setShowInvite(false)}>×</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={forgotS.label}>E-mail do funcionário</label>
              <input style={forgotS.input} type="email" placeholder="funcionario@email.com" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={forgotS.label}>Perfil de acesso</label>
              <select style={forgotS.input} value={role} onChange={e => setRole(e.target.value)}>
                <option value="operator">Operador — só acessa PDV</option>
                <option value="manager">Gerente — PDV + Estoque + Financeiro</option>
              </select>
            </div>
            <button style={{ width: "100%", padding: 12, border: "none", borderRadius: 10, background: "#4ade80", color: "#000", fontWeight: 700, cursor: "pointer" }}
              onClick={sendInvite} disabled={sending}>
              {sending ? "Enviando…" : "Enviar convite"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  9. PAINEL ADMIN MASTER
//  ⚠️ Acessa a view admin_store_stats com service_role key
//     Configure VITE_SUPABASE_SERVICE_KEY no .env (não expor ao cliente!)
//     Em produção use uma Edge Function protegida
// ══════════════════════════════════════════════════════════════
export function AdminMaster({ SUPABASE_URL, SERVICE_KEY }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fmt = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  useEffect(() => { loadStores(); }, []);

  const loadStores = async () => {
    // Usa service_role key para bypassar RLS e ver todas as lojas
    const res = await fetch(`${SUPABASE_URL}/rest/v1/admin_store_stats?order=created_at.desc`, {
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    const data = await res.json();
    setStores(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  const filtered = stores.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.city?.toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = stores.reduce((s, x) => s + Number(x.total_revenue || 0), 0);
  const totalStores  = stores.length;
  const activeStores = stores.filter(s => s.sub_status === "active").length;

  const PLAN_COLOR = { free: "#475569", pro: "#4ade80", premium: "#a78bfa" };

  return (
    <div style={{ padding: 20, maxWidth: 1200 }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 800 }}>👑 Admin Master</h2>
      <p style={{ color: "#475569", fontSize: 13, marginBottom: 20 }}>Visão geral de todas as lojas cadastradas</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 12, marginBottom: 20 }}>
        {[
          ["🏪", "Total de Lojas", totalStores, "#60a5fa"],
          ["✅", "Lojas Ativas", activeStores, "#4ade80"],
          ["💰", "Receita Total (all)", fmt(totalRevenue), "#4ade80"],
          ["📊", "Ticket Médio/Loja", fmt(totalStores ? totalRevenue / totalStores : 0), "#f59e0b"],
        ].map(([ic, lb, vl, cl]) => (
          <div key={lb} style={{ background: "#0d1b2a", border: "1px solid #1e293b", borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{ic}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: cl }}>{vl}</div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>{lb}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#1e293b", borderRadius: 10, padding: "9px 13px", flex: 1, maxWidth: 320 }}>
          <span style={{ color: "#475569" }}>🔍</span>
          <input style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#e2e8f0", fontSize: 14 }}
            placeholder="Buscar loja…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? <div style={{ color: "#475569", padding: 24 }}>Carregando lojas…</div> : (
        <div style={{ background: "#0d1b2a", border: "1px solid #1e293b", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 12, padding: "10px 16px", background: "#0f172a", fontSize: 11, color: "#334155", fontWeight: 700, textTransform: "uppercase" }}>
            <span style={{ flex: 2 }}>Loja</span>
            <span>Plano</span>
            <span style={{ textAlign: "right" }}>Produtos</span>
            <span style={{ textAlign: "right" }}>Vendas</span>
            <span style={{ textAlign: "right" }}>Receita</span>
            <span>Status</span>
            <span>Cadastro</span>
          </div>
          {filtered.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#475569" }}>Nenhuma loja encontrada</div>}
          {filtered.map(s => (
            <div key={s.id} style={{ display: "flex", gap: 12, padding: "11px 16px", borderTop: "1px solid #0f172a", alignItems: "center", fontSize: 13 }}>
              <span style={{ flex: 2 }}>
                <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{s.name}</div>
                <div style={{ fontSize: 11, color: "#475569" }}>{s.city} · {s.state}</div>
              </span>
              <span style={{ background: PLAN_COLOR[s.plan] + "22", color: PLAN_COLOR[s.plan], fontSize: 11, padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                {s.plan?.toUpperCase() || "FREE"}
              </span>
              <span style={{ textAlign: "right", color: "#94a3b8" }}>{s.total_products}</span>
              <span style={{ textAlign: "right", color: "#94a3b8" }}>{s.total_sales}</span>
              <span style={{ textAlign: "right", color: "#4ade80", fontWeight: 700 }}>{fmt(s.total_revenue)}</span>
              <span style={{ background: s.sub_status === "active" ? "#4ade8022" : "#ef444422", color: s.sub_status === "active" ? "#4ade80" : "#f87171", fontSize: 10, padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>
                {s.sub_status === "active" ? "ATIVO" : "SUSPENSO"}
              </span>
              <span style={{ fontSize: 11, color: "#334155" }}>{new Date(s.created_at).toLocaleDateString("pt-BR")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
