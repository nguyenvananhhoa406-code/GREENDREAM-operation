import { google } from 'googleapis';
import { timingSafeEqual } from 'node:crypto';

const SHEET_ID = process.env.GREEN_DREAM_SHEET_ID;
const GROUPS = ['SMOOTHIE','BOWL & BUILD','SỐT','PACKAGING','BẾP'];
const UNITS = ['g','kg','ml','lít','cái','túi','hộp','cuộn','chai','gói','thùng'];
const quoted=s=>`'${s.replaceAll("'","''")}'`;
const clean=(v,n=250)=>String(v??'').trim().slice(0,n);
const fail=(res,status,error)=>res.status(status).json({error});
const validToken=req=>{
  const expected=process.env.INVENTORY_SYNC_TOKEN||'';
  const token=String(req.headers['x-inventory-token']||'');
  if(!expected||!token)return false;
  const a=Buffer.from(expected),b=Buffer.from(token);
  return a.length===b.length&&timingSafeEqual(a,b);
};
async function client(){
  const email=process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key=process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g,'\n');
  if(!email||!key||!SHEET_ID)throw Error('Google Sheets chưa cấu hình');
  const auth=new google.auth.JWT({email,key,scopes:['https://www.googleapis.com/auth/spreadsheets']});
  return google.sheets({version:'v4',auth});
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!validToken(req))return fail(res,401,'Mã truy cập không hợp lệ');
  if(!['GET','POST'].includes(req.method))return fail(res,405,'Method not allowed');
  try{
    const api=await client();
    if(req.method==='GET'){
      const ranges=[...GROUPS.map(g=>`${quoted(g)}!A4:P999`),"'NHÀ CUNG CẤP'!A4:B500","'MÃ VẬT TƯ'!A4:D500"];
      const out=await api.spreadsheets.values.batchGet({spreadsheetId:SHEET_ID,ranges,valueRenderOption:'UNFORMATTED_VALUE',dateTimeRenderOption:'FORMATTED_STRING'});
      const parts=out.data.valueRanges||[];
      const entries=GROUPS.flatMap((group,i)=>(parts[i]?.values||[]).map((r,j)=>({row:j+4,group,date:r[0]||'',item:r[1]||'',quantity:r[2]||'',unit:r[3]||'',unitPrice:r[4]||'',supplier:r[5]||'',total:r[6]||'',materialCode:r[8]||'',entryCode:r[9]||'',quoteUnit:r[10]||''})).filter(r=>r.item));
      return res.json({entries,groups:GROUPS,suppliers:(parts[5]?.values||[]).filter(r=>r[1]).map(r=>({code:r[0],name:r[1]})),materials:(parts[6]?.values||[]).filter(r=>r[1]).map(r=>({code:r[0],name:r[1],unit:r[3]}))});
    }
    const b=req.body||{},group=clean(b.group,60),item=clean(b.item),date=clean(b.date,12),unit=clean(b.unit,15),quoteUnit=clean(b.quoteUnit,15);
    const qty=Number(b.quantity),price=b.unitPrice===''||b.unitPrice==null?'':Number(b.unitPrice);
    if(!GROUPS.includes(group)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||!item||!UNITS.includes(unit)||!UNITS.includes(quoteUnit)||!Number.isFinite(qty)||qty<=0||(price!==''&&(!Number.isFinite(price)||price<0)))return fail(res,400,'Dữ liệu nhập hàng không hợp lệ');
    const existing=await api.spreadsheets.values.get({spreadsheetId:SHEET_ID,range:`${quoted(group)}!A4:B999`});
    const values=existing.data.values||[];
    let row=values.findIndex(r=>!r[0]&&!r[1])+4;
    if(row===3)row=values.length+4;
    if(row>999)return fail(res,409,'Tab nhập hàng đã đầy');
    await api.spreadsheets.values.batchUpdate({spreadsheetId:SHEET_ID,requestBody:{valueInputOption:'USER_ENTERED',data:[
      {range:`${quoted(group)}!A${row}:F${row}`,values:[[date,item,qty,unit,price,clean(b.supplier)]]},
      {range:`${quoted(group)}!H${row}`,values:[[clean(b.note,700)]]},
      {range:`${quoted(group)}!K${row}`,values:[[quoteUnit]]},
      {range:`${quoted(group)}!O${row}`,values:[[clean(b.invoice,100)]]}
    ]}});
    res.json({ok:true,row,group});
  }catch(e){console.error('inventory sync',e.message);return fail(res,500,'Không đồng bộ được Google Sheets; kiểm tra cấu hình Vercel');}
}
