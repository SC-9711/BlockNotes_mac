// Reuse the same converter as the packaged first-launch installer.
import {createRequire} from 'node:module'
const {buildPixelFont}=createRequire(import.meta.url)('../server/pixel-font.cjs')
const result=buildPixelFont('public/minecraft','.local/tooling/unifont/unifont_all_no_pua-15.1.05.hex')
console.log(JSON.stringify(result))
