import {Node} from '@tiptap/core'

// An explicit page boundary stays in the same canonical rich-text document.
// It survives autosave/backup; existing long documents still paginate freely.
export const BookPageBreak=Node.create({
 name:'bookPageBreak',group:'bookBoundary',atom:true,selectable:false,
 parseHTML:()=>[{tag:'div[data-book-page-break]'}],
 renderHTML:()=>['div',{'data-book-page-break':'','class':'book-page-break','contenteditable':'false','aria-hidden':'true'}],
})
// Boundaries belong to the document, never inside a list or quotation.
// This keeps formatting commands from producing pages the store rejects.
export const BookDocument=Node.create({name:'doc',topNode:true,content:'(block|bookBoundary)+'})

export function measurePages(body:HTMLElement,height:number){
 const origin=body.getBoundingClientRect().top
 for(const spacer of body.querySelectorAll<HTMLElement>(':scope > .book-page-break')){
  const offset=spacer.getBoundingClientRect().top-origin
  const next=Math.max(height,Math.ceil((offset-.1)/height)*height)
  spacer.style.height=Math.max(0,next-offset)+'px'
 }
 const last=body.lastElementChild as HTMLElement|null
 const end=last?last.getBoundingClientRect().bottom-origin:0
 const count=Math.max(1,Math.ceil((end-.1)/height))
 // Pad the final sheet so turning to it never clamps to a partial scroll.
 body.style.minHeight=count*height+'px'
 return count
}
