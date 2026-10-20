import {createClient} from './vendor/supabase.mjs';
export const client=createClient('https://sheuekronotkiedufacd.supabase.co','sb_publishable_kGEzpDImPivyKmQK8PK-nw_L8w5V4K0',{
 auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
});
export const bucket='hangwon-books';
export const bookColumns='id,owner_id,title,author,category,summary,description,cover_path,pdf_path,page_count,status,created_at';
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function member(){const {data,error}=await client.auth.getUser();if(error||!data.user||data.user.is_anonymous||!data.user.email_confirmed_at)throw Error('회원가입과 이메일 확인 후 로그인해 주세요.');return data.user;}
export async function signed(path){const {data,error}=await client.storage.from(bucket).createSignedUrl(path,300);if(error)throw Error('파일을 열지 못했습니다. 잠시 후 다시 시도해 주세요.');return data.signedUrl;}
export async function published(){const {data,error}=await client.from('hangwon_books').select(bookColumns).eq('status','published').order('created_at',{ascending:false}).limit(100);if(error)throw error;return data;}
export async function publicBook(id){const {data,error}=await client.from('hangwon_books').select(bookColumns).eq('id',id).eq('status','published').maybeSingle();if(error)throw error;return data;}
export async function mapBook(row){return {...row,cover:await signed(row.cover_path),pdfPath:row.pdf_path,readingOnly:true,published:true};}
export async function pdfDocument(data){const pdf=await import('./vendor/pdf.mjs');pdf.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdf.worker.mjs',import.meta.url).href;return pdf.getDocument({data,isEvalSupported:false,enableXfa:false,cMapUrl:new URL('./vendor/cmaps/',import.meta.url).href,cMapPacked:true,standardFontDataUrl:new URL('./vendor/standard_fonts/',import.meta.url).href,wasmUrl:new URL('./vendor/wasm/',import.meta.url).href}).promise;}
export async function pdfFromPath(path){const url=await signed(path),r=await fetch(url);if(!r.ok)throw Error('PDF를 불러오지 못했습니다.');return pdfDocument(new Uint8Array(await r.arrayBuffer()));}
