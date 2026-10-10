import {useEffect,useState,type ReactNode} from 'react'
import type {ResourceState} from './types'
export default function ResourceSetup({children}:{children:ReactNode}){
 const [state,setState]=useState<ResourceState|null>(null),[failure,setFailure]=useState('')
 const desktop=window.blocknotes
 useEffect(()=>{
  if(!desktop)return
  let active=true,installing=false
  const update=(next:ResourceState)=>{if(!active)return;if(next.ready&&installing){window.location.reload();return}setState(next)}
  const dispose=desktop.onResources(next=>{installing=true;update(next)})
  desktop.call('resourceStatus').then(async next=>{if(!active)return;update(next);if(!next.ready){installing=true;update(await desktop.call('resourceStart'))}}).catch(error=>{if(active)setFailure(error.message)})
  return()=>{active=false;dispose()}
 },[])
 if(!desktop||state?.ready)return children
 const retry=()=>{setFailure('');desktop.call('resourceStart').then(setState).catch(error=>setFailure(error.message))}
 const fraction=state?.total?Math.min(1,state.done/state.total):0
 const detail=state?.total?(state.total>10000?`${(state.done/1048576).toFixed(1)} / ${(state.total/1048576).toFixed(1)} MB`:`${state.done} / ${state.total} 个文件`):'请稍候…'
 return <main className="resource-setup"><section role="dialog" aria-modal="true" aria-label="准备书房资源" className="resource-panel">
  <h1>准备书房资源</h1><p>首次启动自动准备 Java 1.21 的方块、界面、字体、音效与 19 张唱片。</p><p>完成后进入书房，之后可离线使用。笔记保存在本机。</p>
  <div role="status" aria-live="polite">{state?.phase||'检查本地资源'}</div><progress aria-label="资源下载进度" {...(state?.total?{value:fraction,max:1}:{})}/><small>{detail}</small>
  {(state?.error||failure)&&<p role="alert">{state?.error||failure}</p>}
  <div className="resource-buttons">{(state?.error||failure)&&<button className="resource-button" onClick={retry}>重试</button>}<button className="resource-button" onClick={()=>desktop.call('resourceQuit')}>取消并退出</button></div>
  <small>非官方应用。原版资源来自 Mojang 官方服务器，保留原版权；本程序不内置游戏素材。</small>
 </section></main>
}
