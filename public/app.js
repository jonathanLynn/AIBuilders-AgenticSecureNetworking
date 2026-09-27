const state = { token: sessionStorage.getItem("labToken"), user: JSON.parse(sessionStorage.getItem("labUser") || "null"), modules: [], progress: { completed: [], answers: {} }, active: 0 };
const $ = (s) => document.querySelector(s);

async function request(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { "content-type": "application/json", ...(state.token ? { authorization: `Bearer ${state.token}` } : {}), ...options.headers } });
  const value = await res.json();
  if (!res.ok) throw new Error(value.error || "Request failed");
  return value;
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const result = await request("/api/login", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
    state.token = result.token; state.user = result.user;
    sessionStorage.setItem("labToken", state.token); sessionStorage.setItem("labUser", JSON.stringify(state.user));
    await boot();
  } catch (error) { $("#login-error").textContent = error.message; }
});

async function boot() {
  if (!state.token) return;
  try {
    const [modules, progress, health] = await Promise.all([request("/api/modules"), request("/api/progress"), request("/api/health")]);
    state.modules = modules; state.progress = progress;
    $("#login").classList.add("hidden"); $("#app").classList.remove("hidden");
    $("#user-name").textContent = state.user.name;
    $("#user-initials").textContent = state.user.name.split(/\s+/).map(x => x[0]).join("").slice(0,2).toUpperCase();
    $("#env-status").textContent = health.status.toUpperCase();
    renderNav(); await renderModule(0);
  } catch { sessionStorage.clear(); state.token = null; }
}

function renderNav() {
  $("#module-nav").innerHTML = state.modules.map((m, i) => `<button class="nav-item ${i === state.active ? "active" : ""} ${state.progress.completed.includes(m.id) ? "done" : ""}" data-index="${i}"><span class="nav-number">0${i+1}</span><span class="nav-name">${m.shortTitle}</span></button>`).join("");
  document.querySelectorAll(".nav-item").forEach(b => b.onclick = () => renderModule(Number(b.dataset.index)));
}

async function renderModule(index) {
  state.active = index; const m = state.modules[index];
  $("#module-kicker").textContent = `MODULE 0${index + 1}`; $("#module-title").textContent = m.shortTitle;
  $("#progress-bar").style.width = `${(state.progress.completed.length / state.modules.length) * 100}%`;
  let interactive = "";
  if (m.id === "defend") interactive = renderScan(await request("/api/scan-report"));
  if (m.id === "access") interactive = renderPolicy(await request("/api/secure-access"));
  if (m.id === "topology") interactive = renderTopology(await request("/api/topology"));
  if (m.id === "orchestrate") interactive = renderWorkflow(m.workflow);
  $("#module-content").innerHTML = `<div class="module-grid"><div class="lesson"><p class="eyebrow">${m.eyebrow}</p><h3>${m.title}</h3><p class="intro">${m.intro}</p><div class="objective"><b>◎</b><p><strong>Mission.</strong> ${m.objective}</p></div>${interactive}<div class="steps">${m.steps.map(s => `<section class="step"><h4>${s.title}</h4><p>${s.body}</p>${s.command ? `<pre class="code"><code>${escapeHtml(s.command)}</code></pre>` : ""}</section>`).join("")}</div></div><aside class="side-card"><p class="step-label">MISSION CONTROL</p><h3>Exit criteria</h3><ul class="checklist">${m.checklist.map(x => `<li>${x}</li>`).join("")}</ul>${renderQuiz(m)}<button class="complete" ${state.progress.answers[m.id] === m.quiz.correct ? "" : "disabled"}>${state.progress.completed.includes(m.id) ? "Completed ✓" : "Complete module"}</button></aside></div>`;
  bindQuiz(m); renderNav();
}

function renderQuiz(m) { return `<div class="quiz"><p class="step-label">KNOWLEDGE CHECK</p><p>${m.quiz.question}</p>${m.quiz.options.map((o,i) => `<button class="answer" data-answer="${i}">${o}</button>`).join("")}<p class="quiz-feedback"></p></div>`; }
function bindQuiz(m) {
  document.querySelectorAll(".answer").forEach(btn => btn.onclick = () => {
    const answer = Number(btn.dataset.answer); state.progress.answers[m.id] = answer;
    document.querySelectorAll(".answer").forEach((b,i) => {
      b.classList.remove("correct", "wrong");
      if (i === answer) b.classList.add(answer === m.quiz.correct ? "correct" : "wrong");
    });
    $(".quiz-feedback").textContent = answer === m.quiz.correct ? `Correct — ${m.quiz.explanation}` : "Not quite. Revisit the evidence in this module and try again.";
    $(".complete").disabled = answer !== m.quiz.correct; save();
  });
  $(".complete").onclick = async () => { if (!state.progress.completed.includes(m.id)) state.progress.completed.push(m.id); await save(); renderModule(Math.min(state.active + 1, state.modules.length - 1)); };
}
async function save() { $("#save-state").textContent = "SAVING…"; await request("/api/progress", { method:"PUT", body:JSON.stringify(state.progress) }); $("#save-state").textContent = "PROGRESS SAVED"; }
function renderScan(r) { return `<div class="report"><div class="report-head"><div><p class="step-label">SCAN REPORT / ${r.scanId}</p><h4>${r.target}</h4></div><span class="severity">${r.summary.high} HIGH RISK</span></div>${r.findings.map(f => `<div class="finding"><strong>${f.rule}</strong><p>${f.evidence}</p><span class="severity">${f.severity}</span></div>`).join("")}</div>`; }
function renderPolicy(p) { return `<div class="report"><div class="report-head"><div><p class="step-label">POLICY SNAPSHOT</p><h4>${p.tenant}</h4></div><span class="severity">${p.gaps.length} OPPORTUNITIES</span></div>${p.gaps.map(g => `<div class="finding"><strong>${g.title}</strong><p>${g.evidence} Recommendation: ${g.recommendation}</p></div>`).join("")}</div>`; }
function renderTopology(t) { const edges=t.edges.map(e=>{const a=t.nodes.find(n=>n.id===e.from),b=t.nodes.find(n=>n.id===e.to),dx=b.x-a.x,dy=b.y-a.y;return `<i class="edge" style="left:${a.x+6}%;top:${a.y+5}%;width:${Math.hypot(dx,dy)}%;transform:rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)"></i>`}).join(""); return `<div class="topology">${edges}${t.nodes.map(n=>`<div class="node ${n.status==='alert'?'alert':''}" style="left:${n.x}%;top:${n.y}%">${n.label}<br><small>${n.kind}</small></div>`).join("")}</div>`; }
function renderWorkflow(flow) { return `<div class="workflow">${flow.map((a,i)=>`${i?'<span class="arrow">→</span>':''}<div class="agent"><span>AGENT 0${i+1}</span><h5>${a.name}</h5><p>${a.role}</p></div>`).join("")}</div>`; }
function escapeHtml(s) { return s.replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"})[c]); }
boot();
