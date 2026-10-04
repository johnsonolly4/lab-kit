class El {
  constructor(tag){ this.tagName=tag.toUpperCase(); this.children=[]; this.parent=null; this.attrs={}; this.classList=new CL(this); this._text=""; this.listeners={}; this.style={setProperty(){}}; }
  get className(){ return [...this.classList.s].join(" "); } set className(v){ this.classList.s=new Set(String(v).split(/\s+/).filter(Boolean)); }
  appendChild(c){ if(c.parent) c.parent.removeChild(c); c.parent=this; this.children.push(c); return c; }
  removeChild(c){ this.children=this.children.filter(x=>x!==c); c.parent=null; }
  remove(){ this.parent && this.parent.removeChild(this); }
  get firstChild(){ return this.children[0]; } get childElementCount(){ return this.children.length; }
  get textContent(){ return this._text + this.children.map(c=>c.textContent).join(""); }
  set textContent(t){ this.children=[]; this._text=String(t); }
  set innerHTML(h){ this.children=[]; this._text=String(h).replace(/<[^>]+>/g,""); }
  setAttribute(k,v){ this.attrs[k]=String(v); } getAttribute(k){ return this.attrs[k]; }
  addEventListener(t,f){ (this.listeners[t] ||= []).push(f); }
  dispatch(t,extra={}){ (this.listeners[t]||[]).forEach(f=>f({ preventDefault(){}, stopPropagation(){}, target:this, ...extra })); }
  setCssProps(){} get offsetWidth(){ return 80; }
  get isConnected(){ return true; }
  matches(simple){ const [tag,...cls]=simple.split("."); return (!tag || this.tagName===tag.toUpperCase()) && cls.every(c=>this.classList.contains(c)); }
  all(){ return this.children.flatMap(c=>[c,...c.all()]); }
  querySelectorAll(sel){ const parts=sel.trim().split(/\s+/); let set=[this];
    for(const p of parts){ set=[...new Set(set.flatMap(e=>e.all().filter(x=>x.matches(p))))]; } return set; }
  querySelector(sel){ return this.querySelectorAll(sel)[0] ?? null; }
  closest(sel){ let e=this; while(e){ if(e.matches(sel)) return e; e=e.parent; } return null; }
  focus(){} select(){} setSelectionRange(a,b){ this.selectionStart=a; this.selectionEnd=b; }
  get ownerDocument(){ return { activeElement: null }; }
  // Obsidian helpers
  empty(){ this.children=[]; this._text=""; }
  createEl(tag,o={}){ const e=new El(tag); if(o.cls) e.className=o.cls; if(o.text!=null) e._text=String(o.text); if(o.attr) for(const k in o.attr) e.setAttribute(k,o.attr[k]); this.appendChild(e); return e; }
  createDiv(o){ return this.createEl("div",o); } createSpan(o){ return this.createEl("span",o); }
  addClass(c){ this.classList.add(c); } toggleClass(c,b){ b?this.classList.add(c):this.classList.remove(c); }
  appendText(t){ const e=new El("#text"); e._text=String(t); this.appendChild(e); }
  setText(t){ this.textContent=t; } setAttr(k,v){ this.setAttribute(k,v); }
}
class CL { constructor(){ this.s=new Set(); } add(c){ this.s.add(c); } remove(c){ this.s.delete(c); } contains(c){ return this.s.has(c); } }
module.exports = { El };
