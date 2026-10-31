const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={run:null,poll:null,models:[],running:false};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(s){const t=$('#toast');t.textContent=s;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
async function api(url,options={}){const r=await fetch(url,{headers:{'Content-Type':'application/json',...(options.headers||{})},...options});if(!r.ok){let d={};try{d=await r.json()}catch{}throw Error(d.error||`请求失败 ${r.status}`)}return r.status===204?null:r.json()}
function addCase(data={}){if($$('.case-card').length>=12){toast('最多添加 12 条评测用例');return}const node=$('#caseTemplate').content.cloneNode(true),card=node.querySelector('.case-card');card.querySelector('.case-name').value=data.name||'';card.querySelector('.case-input').value=data.input||'';card.querySelector('.case-criteria').value=data.criteria||'';card.querySelector('.case-expected').value=data.expectedOutput||'';card.querySelector('.case-holdout').checked=!!data.holdout;card.querySelector('.remove-case').onclick=()=>{card.remove();renumber();saveDraft()};card.querySelectorAll('input,textarea').forEach(x=>x.addEventListener('input',saveDraft));card.querySelector('.case-holdout').addEventListener('change',saveDraft);$('#cases').append(node);renumber()}
function renumber(){$$('.case-card').forEach((c,i)=>c.querySelector('.case-number').textContent=String(i+1).padStart(2,'0'))}
function readForm(){return{goal:$('#goal').value.trim(),originalPrompt:$('#prompt').value.trim(),criteria:$('#criteria').value.trim(),model:$('#model').value,maxRounds:Number($('#rounds').value),cases:$$('.case-card').map((x,i)=>({name:x.querySelector('.case-name').value.trim()||`用例 ${i+1}`,input:x.querySelector('.case-input').value.trim(),criteria:x.querySelector('.case-criteria').value.trim(),expectedOutput:x.querySelector('.case-expected').value.trim(),holdout:x.querySelector('.case-holdout').checked}))}}
function saveDraft(){try{localStorage.setItem('promptlab.draft',JSON.stringify({...readForm(),model:$('#model').value}))}catch{}}
function restoreDraft(){try{const d=JSON.parse(localStorage.getItem('promptlab.draft')||'null');if(!d){addCase({name:'代表性调优案例'});addCase({name:'独立回归案例',holdout:true});return}$('#goal').value=d.goal||'';$('#prompt').value=d.originalPrompt||'';$('#criteria').value=d.criteria||'';$('#rounds').value=String(d.maxRounds||2);if(Array.isArray(d.cases)&&d.cases.length){d.cases.forEach(addCase)}else{addCase();addCase({holdout:true})}}catch{addCase();addCase({holdout:true})}}
async function loadStatus(){try{const s=await api('/api/status');const c=$('#connection');c.className='connection '+(s.ok?'ok':'bad');c.querySelector('span').textContent=s.ok?`本机 Ollama · ${s.models.length} 个模型`:'未连接 Ollama';$('#model').innerHTML=s.models.length?s.models.map(m=>`<option value="${esc(m)}">${esc(m)}</option>`).join(''):'<option value="">暂无可用模型</option>';if(s.models.includes('qwen3-vl:4b'))$('#model').value='qwen3-vl:4b';else if(s.models.length)$('#model').value=s.models[0];if(!s.ok)c.title=s.error||''}catch{$('#connection').className='connection bad';$('#connection span').textContent='本机模型状态读取失败'}}
async function refreshHistory(){try{const list=await api('/api/runs'),box=$('#history');$('#runCount').textContent=list.length;if(!list.length){box.innerHTML='<div class="history-empty">调优完成后会保存在这里</div>';return}box.innerHTML=list.slice(0,30).map(x=>`<button class="history-item ${state.run?.id===x.id?'active':''}" data-id="${esc(x.id)}"><b>${esc(x.Goal||x.goal||'未命名调优')}</b><small>${new Date(x.createdAt||x.CreatedAt).toLocaleDateString()} · ${x.humanDecision==='adopted'?'已采纳':x.passedGate?'回归通过':'待检查'}</small></button>`).join('');box.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>openReport(b.dataset.id))}catch{}}
function showEditor(){stopPoll();$('#introBlock').classList.remove('hidden');$('#editor').classList.remove('hidden');$('#progress').classList.add('hidden');$('#result').classList.add('hidden');window.scrollTo({top:0,behavior:'smooth'})}
async function startRun(){const req=readForm();if(!req.goal||!req.originalPrompt||!req.criteria){toast('请先填写目标、现有提示词和整体验收标准');return}if(!req.model){toast('本机没有可用模型，请先启动 Ollama');return}if(req.cases.some(x=>!x.input||!x.criteria)){toast('每条测试用例都需要填写输入和本例验收标准');return}if(!req.cases.some(x=>!x.holdout)||!req.cases.some(x=>x.holdout)){toast('请至少设置一条调优用例和一条独立回归用例');return}$('#start').disabled=true;$('#introBlock').classList.add('hidden');$('#editor').classList.add('hidden');$('#result').classList.add('hidden');$('#progress').classList.remove('hidden');try{const started=await api('/api/runs',{method:'POST',body:JSON.stringify(req)});state.run={id:started.id,request:req};saveDraft();await pollRun(started.id)}catch(e){$('#introBlock').classList.remove('hidden');$('#editor').classList.remove('hidden');$('#progress').classList.add('hidden');toast(e.message)}finally{$('#start').disabled=false}}
async function pollRun(id){state.running=true;const tick=async()=>{try{const r=await api(`/api/runs/${id}`);$('#phase').textContent=r.phase||'正在调优';if(r.status==='running'){state.poll=setTimeout(tick,1300);return}state.running=false;stopPoll();state.run=r;$('#progress').classList.add('hidden');if(r.status==='completed'){renderReport(r);await refreshHistory()}else{$('#introBlock').classList.remove('hidden');$('#editor').classList.remove('hidden');toast(r.error||'调优已停止，原提示词未更改')}}catch(e){state.running=false;stopPoll();$('#introBlock').classList.remove('hidden');$('#editor').classList.remove('hidden');$('#progress').classList.add('hidden');toast(e.message)}};await tick()}
function stopPoll(){if(state.poll){clearTimeout(state.poll);state.poll=null}}
async function cancelRun(){if(!state.run?.id)return;try{await api(`/api/runs/${state.run.id}/cancel`,{method:'POST',body:'{}'});$('#phase').textContent='正在安全停止当前本机请求…'}catch(e){toast(e.message)}}
async function openReport(id){try{const r=await api(`/api/runs/${id}`);state.run=r;renderReport(r);await refreshHistory()}catch(e){toast(e.message)}}
function renderReport(r){$('#introBlock').classList.add('hidden');$('#editor').classList.add('hidden');$('#progress').classList.add('hidden');$('#result').classList.remove('hidden');$('#resultTitle').textContent=r.status==='completed'?'调优结果':'未完成的调优';$('#resultSummary').textContent=`本机模型 ${r.model} · ${new Date(r.createdAt).toLocaleString()} · ${r.round}/${r.maxRounds} 轮`;
 $('#baseScore').textContent=Number(r.baselineScore).toFixed(2);$('#candidateScore').textContent=Number(r.candidateScore).toFixed(2);$('#holdoutScore').textContent=`${Number(r.holdoutBaselineScore).toFixed(1)} → ${Number(r.holdoutCandidateScore).toFixed(1)}`;
 const gate=$('#gate');gate.textContent=r.passedGate?'通过回归门槛':'未通过回归门槛';gate.className='gate '+(r.passedGate?'pass':'fail');$('#resultSummary').textContent=`${r.phase} · 原版 ${Number(r.baselineScore).toFixed(2)} → 候选 ${Number(r.candidateScore).toFixed(2)}（满分 5）`;
 $('#events').innerHTML=(r.events||[]).map(e=>`<li><time>${new Date(e.at).toLocaleTimeString()}</time><span>${esc(e.message)}</span></li>`).join('');
 $('#originalResult').textContent=r.originalPrompt;$('#candidateResult').textContent=r.candidatePrompt;$('#changes').innerHTML=(r.changes?.length?r.changes:['请对照原版自行检查差异。']).map(x=>`<li>${esc(x)}</li>`).join('');
 $('#caseResults').innerHTML=(r.cases||[]).map(c=>`<article class="eval-card"><header class="eval-head"><b>${esc(c.name)}</b><span class="eval-type">${c.holdout?'独立回归':'调优用例'}</span><span class="eval-type">${esc(c.evaluationMethod||'模型评审')}</span><span class="eval-scores">原版 ${c.baselineScore}/5　→　<strong>候选 ${c.candidateScore}/5</strong></span></header><div class="eval-assessment">${esc(c.assessment||'暂无评分说明')}${c.expectedOutput?`<br>期望输出：${esc(c.expectedOutput)}`:''}</div><div class="eval-outputs"><section class="eval-output"><small>原版输出</small><p>${esc(c.baselineOutput)}</p></section><section class="eval-output"><small>候选输出</small><p>${esc(c.candidateOutput)}</p></section></div></article>`).join('');
 $('#adopt').disabled=!r.passedGate||r.status!=='completed'||r.humanDecision==='adopted';$('#keepOriginal').disabled=r.status!=='completed';$('#decisionNote').value=r.decisionNote||'';$('#decisionHelp').textContent=r.humanDecision==='adopted'?'已采纳此候选版本。':r.humanDecision==='kept-original'?'已记录：保留原版。':r.passedGate?'通过门槛也不代表一定更好；确认评测输出符合预期后再采纳。':'候选没有通过回归门槛，保留原版；修改提示词或样例后可以重新调优。';$('#adopt').textContent=r.humanDecision==='adopted'?'已采纳　✓':'采纳候选　→';window.scrollTo({top:0,behavior:'smooth'})}
async function decide(decision){const r=state.run;if(!r||r.status!=='completed')return;try{await api(`/api/runs/${r.id}/decision`,{method:'POST',body:JSON.stringify({decision,note:$('#decisionNote').value.trim()})});if(decision==='adopted'){$('#prompt').value=r.candidatePrompt;saveDraft();toast('候选已采纳到编辑区；原版和报告仍保留')}else toast('已记录保留原版');await openReport(r.id)}catch(e){toast(e.message)}}
function download(name,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportBundle(){download('promptlab-workspace.json',{format:'promptlab/v1',exportedAt:new Date().toISOString(),definition:readForm()})}
function exportReport(){if(state.run)download(`promptlab-report-${state.run.id.slice(0,8)}.json`,{format:'promptlab-report/v1',...state.run})}
async function importBundle(file){try{const d=JSON.parse(await file.text());const f=d.definition||d;if(!f.goal||!f.originalPrompt||!Array.isArray(f.cases))throw Error('文件中没有有效的 PromptLab 工作包');$('#goal').value=f.goal;$('#prompt').value=f.originalPrompt;$('#criteria').value=f.criteria||'';$('#rounds').value=String(f.maxRounds||2);$('#cases').innerHTML='';f.cases.forEach(addCase);saveDraft();showEditor();toast('工作包已导入；文件只在本机读取')}catch(e){toast(`导入失败：${e.message}`)}finally{$('#bundleFile').value=''}}
$('#addCase').onclick=()=>{addCase();saveDraft()};$('#start').onclick=startRun;$('#cancel').onclick=cancelRun;$('#newRun').onclick=()=>{state.run=null;$('#goal').value='';$('#prompt').value='';$('#criteria').value='';$('#cases').innerHTML='';$('#rounds').value='2';addCase();addCase({holdout:true});saveDraft();showEditor()};$('#newFromResult').onclick=showEditor;$('#keepOriginal').onclick=()=>decide('kept-original');$('#adopt').onclick=()=>decide('adopted');$('#exportBundle').onclick=exportBundle;$('#exportReport').onclick=exportReport;$('#importBundle').onclick=()=>$('#bundleFile').click();$('#bundleFile').onchange=e=>{if(e.target.files?.[0])importBundle(e.target.files[0])};
$$('.copy').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.copy==='original'?$('#originalResult').textContent:$('#candidateResult').textContent);toast('已复制到剪贴板')}catch{toast('浏览器未开放剪贴板权限，请手动选择并复制')}});
$('#goal').addEventListener('input',saveDraft);$('#prompt').addEventListener('input',saveDraft);$('#criteria').addEventListener('input',saveDraft);$('#rounds').addEventListener('change',saveDraft);$('#model').addEventListener('change',saveDraft);
(async()=>{restoreDraft();await loadStatus();await refreshHistory()})();

/* ==================== 模型一键配置（自动注入） ==================== */
(function () {
  if (window.__modelSetupMounted) return;
  window.__modelSetupMounted = true;

  var css = document.createElement('style');
  css.textContent = [
    '#msetup{position:fixed;right:16px;bottom:16px;z-index:9999;background:#153a35;color:#eaf4f1;',
    'border-radius:12px;padding:12px 14px;min-width:280px;max-width:340px;',
    'box-shadow:0 8px 28px rgba(0,0,0,.28);font:13px/1.55 system-ui,"Segoe UI",sans-serif}',
    '#msetup .ms-title{font-weight:600;margin-bottom:6px}',
    '#msetup .ms-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}',
    '#msetup .ms-state{opacity:.88}',
    '#msetup button{background:#2ea88a;color:#fff;border:0;border-radius:8px;padding:7px 14px;font-size:13px;cursor:pointer}',
    '#msetup button:disabled{opacity:.55;cursor:default}',
    '#msetup .ms-bar{height:8px;border-radius:6px;background:rgba(255,255,255,.18);overflow:hidden}',
    '#msetup .ms-bar > i{display:block;height:100%;width:0;background:#4dd0aa;transition:width .25s}',
    '#msetup .ms-text{font-size:12px;opacity:.82;margin-top:6px;word-break:break-all}',
    '#msetup .ms-err{color:#ffb4a8}'
  ].join('');

  function mount() {
    if (document.getElementById('msetup')) return;
    document.head.appendChild(css);

    var box = document.createElement('div');
    box.id = 'msetup';
    box.innerHTML =
      '<div class="ms-title">本地模型</div>' +
      '<div class="ms-row"><span class="ms-state">检测中…</span></div>' +
      '<div class="ms-row"><button type="button">一键配置</button></div>' +
      '<div class="ms-prog" hidden><div class="ms-bar"><i></i></div><div class="ms-text"></div></div>';
    document.body.appendChild(box);

    var stateEl = box.querySelector('.ms-state');
    var btn = box.querySelector('button');
    var prog = box.querySelector('.ms-prog');
    var bar = box.querySelector('.ms-bar > i');
    var text = box.querySelector('.ms-text');
    var es = null;

    function pct(s) {
      if (!s.total || s.total <= 0) return null;
      return Math.max(0, Math.min(100, Math.round(s.completed * 100 / s.total)));
    }

    function mb(v) { return (v / 1048576).toFixed(0); }

    function render(s) {
      if (s.ready) {
        stateEl.textContent = '● 已就绪（' + s.model + '）';
        btn.hidden = true;
        prog.hidden = true;
        if (es) { es.close(); es = null; }
        return;
      }
      btn.hidden = false;

      if (s.running) {
        btn.disabled = true;
        btn.textContent = '配置中…';
        prog.hidden = false;
        var p = pct(s);
        bar.style.width = (p === null ? 100 : p) + '%';
        bar.style.opacity = (p === null ? 0.35 : 1);
        var label = s.status || '处理中';
        if (p !== null) label += '　' + p + '%　' + mb(s.completed) + ' / ' + mb(s.total) + ' MB';
        text.textContent = label;
        text.className = 'ms-text';
        return;
      }

      if (s.phase === 'error') {
        btn.disabled = false;
        btn.textContent = '重试';
        prog.hidden = false;
        bar.style.width = '100%';
        bar.style.opacity = 0.25;
        text.textContent = s.error || '配置失败';
        text.className = 'ms-text ms-err';
        if (es) { es.close(); es = null; }
        return;
      }

      btn.disabled = false;
      btn.textContent = '一键配置';
      prog.hidden = true;
      stateEl.textContent = s.ollamaRunning ? '● 未安装模型' : '● Ollama 未运行（将自动启动）';
    }

    function poll() {
      fetch('/api/setup/state').then(function (r) { return r.json(); }).then(render).catch(function () { });
    }

    function listen() {
      if (es) { es.close(); es = null; }
      es = new EventSource('/api/setup/progress');
      es.onmessage = function (ev) {
        try {
          var s = JSON.parse(ev.data);
          render(s);
          if (!s.running) { es.close(); es = null; }
        } catch (e) { }
      };
      es.onerror = function () { if (es) { es.close(); es = null; } };
    }

    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = '配置中…';
      prog.hidden = false;
      bar.style.width = '0%';
      bar.style.opacity = 1;
      text.textContent = '正在启动…';
      text.className = 'ms-text';
      stateEl.textContent = '● 配置中';
      fetch('/api/setup/ensure-model', { method: 'POST' })
        .then(function () { listen(); })
        .catch(function (e) {
          btn.disabled = false;
          btn.textContent = '重试';
          text.textContent = '请求失败：' + e.message;
          text.className = 'ms-text ms-err';
        });
    });

    poll();
    setInterval(function () { if (!es && !btn.disabled) poll(); }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
