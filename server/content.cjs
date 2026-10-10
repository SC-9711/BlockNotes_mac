const TYPES = new Set(['doc','paragraph','text','heading','bulletList','orderedList','listItem','blockquote','codeBlock','hardBreak','horizontalRule','bookPageBreak']);
const MARKS = new Set(['bold','italic','strike','code','link','underline']);
function validateDoc(doc) {
  if (!doc || doc.type !== 'doc') throw new Error('正文格式无效');
  let count = 0;
  function visit(n, depth, parent) {
    if (++count > 100000 || depth > 32 || !n || !TYPES.has(n.type)) throw new Error('正文结构无效或过大');
    if (n.type === 'bookPageBreak' && (parent !== 'doc' || n.content?.length || n.attrs || n.marks)) throw new Error('分页节点无效');
    if (n.text !== undefined && (typeof n.text !== 'string' || n.type !== 'text')) throw new Error('正文文本无效');
    if (n.content !== undefined) { if (!Array.isArray(n.content)) throw new Error('正文节点无效'); n.content.forEach(c => visit(c, depth+1,n.type)); }
    if (n.marks !== undefined && (!Array.isArray(n.marks) || n.marks.some(m => !MARKS.has(m.type)))) throw new Error('正文样式无效');
    if (n.type === 'heading' && ![1,2,3,4,5,6].includes(n.attrs?.level)) throw new Error('标题层级无效');
    for (const m of n.marks || []) if (m.type === 'link' && !/^(https?:|mailto:)/i.test(m.attrs?.href || '')) throw new Error('链接仅支持 http、https 和 mailto');
  }
  visit(doc, 0);
  if (JSON.stringify(doc).length > 8_000_000) throw new Error('单篇正文超过 8 MB');
  return doc;
}
function plainText(n) { return n.text ?? (n.type === 'hardBreak' ? '\n' : (n.content || []).map(plainText).join(['doc','bulletList','orderedList'].includes(n.type) ? '\n' : '')); }
function markdown(n) {
  if (n.type === 'text') {
    let s = n.text.replace(/[\\`*_\[\]<>]/g, '\\$&');
    for (const m of n.marks || []) {
      if(m.type==='code') s='`'+n.text.replace(/`/g,'\\`')+'`';
      if(m.type==='bold') s='**'+s+'**';
      if(m.type==='italic') s='*'+s+'*';
      if(m.type==='strike') s='~~'+s+'~~';
      if(m.type==='link') s='['+s+']('+String(m.attrs.href).replace(/[()\s]/g, c => encodeURIComponent(c))+')';
    } return s;
  }
  const c=(n.content||[]).map(markdown);
  switch(n.type) {
    case 'doc': return c.join('\n\n');
    case 'heading': return '#'.repeat(n.attrs.level)+' '+c.join('');
    case 'paragraph': return c.join('');
    case 'hardBreak': return '  \n';
    case 'horizontalRule': return '---';
    case 'bookPageBreak': return '<!-- page break -->';
    case 'blockquote': return c.join('\n\n').split('\n').map(x=>'> '+x).join('\n');
    case 'codeBlock': { const text=plainText(n); const fence='`'.repeat(Math.max(3, ...(text.match(/`+/g)||[]).map(s=>s.length+1))); return fence+(n.attrs?.language||'')+'\n'+text+'\n'+fence; }
    case 'listItem': return c.join('\n\n');
    case 'bulletList': return c.map(s=>'- '+s.replace(/\n/g,'\n  ')).join('\n');
    case 'orderedList': return c.map((s,i)=>`${(n.attrs?.start||1)+i}. `+s.replace(/\n/g,'\n   ')).join('\n');
    default: return c.join('');
  }
}
module.exports={validateDoc,plainText,markdown};
