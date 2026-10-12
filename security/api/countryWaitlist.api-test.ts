jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ rpc: mockRpc }) }))
jest.mock('../../admin/node_modules/@supabase/supabase-js', () => ({ createClient: () => ({ rpc: mockRpc }) }))
jest.mock('../../admin/lib/config', () => ({ getSupabaseAdminConfig: () => ({ url: 'https://database.test', key: 'test-only' }) }))

import { POST } from '../../admin/app/api/country-waitlist/route'
import { POST as cleanup } from '../../admin/app/api/internal/country-waitlist-cleanup/route'

const mockRpc = jest.fn()
const rpc = mockRpc
const fetchMock = jest.fn()
const originalFetch = global.fetch
const env = { ...process.env }
const request = (overrides = {}, headers = {}) => new Request('https://app.tshelo.com/api/country-waitlist', {
  method: 'POST', headers: { 'content-type': 'application/json','x-vercel-forwarded-for':'203.0.113.1',...headers },
  body: JSON.stringify({ country_code:'ken',email:' Test@Example.com ',captcha_token:'token',...overrides }),
})

beforeEach(() => {
  jest.clearAllMocks()
  Object.assign(process.env, { WAITLIST_ENABLED:'true',VERCEL:'1',WAITLIST_TURNSTILE_SECRET_KEY:'secret',WAITLIST_RATE_LIMIT_KEY:'hash-key',WAITLIST_TURNSTILE_HOSTNAME:'app.tshelo.com',WAITLIST_CLEANUP_SECRET:'cleanup-secret' })
  rpc.mockImplementation((name: string) => Promise.resolve({data:name==='consume_country_waitlist_limits'?true:null,error:null}))
  fetchMock.mockResolvedValue(Response.json({success:true,hostname:'app.tshelo.com',action:'country_waitlist'}))
  global.fetch=fetchMock
})
afterAll(() => { process.env=env; global.fetch=originalFetch })

it('fails closed when disabled or no trusted proxy is configured',async()=>{
  process.env.WAITLIST_ENABLED='false'
  expect((await POST(request())).status).toBe(503)
  process.env.WAITLIST_ENABLED='true'; process.env.VERCEL='0'
  expect((await POST(request())).status).toBe(503)
  expect(rpc).not.toHaveBeenCalled()
})
it('rejects spoofed generic IP headers and malformed/extra input',async()=>{
  expect((await POST(request({}, {'x-vercel-forwarded-for':'','x-forwarded-for':'203.0.113.1'}))).status).toBe(503)
  for(const input of [{email:'bad'},{phone:'123'},{country_code:'XX'},{approved:true},{email:42},{captcha_token:''}]) expect((await POST(request(input))).status).toBe(400)
  expect((await POST(request({email:'a'.repeat(5000)}))).status).toBe(413)
  expect(rpc).not.toHaveBeenCalled()
})
it('hashes IP/contact identity and limits attempts before CAPTCHA calls',async()=>{
  rpc.mockResolvedValue({data:false,error:null})
  expect((await POST(request())).status).toBe(429)
  const [,args]=rpc.mock.calls[0]
  expect(args.p_ip_key).toMatch(/^[a-f0-9]{64}$/)
  expect(args.p_contact_keys[0]).toMatch(/^[a-f0-9]{64}$/)
  expect(JSON.stringify(args)).not.toContain('Example')
  expect(fetchMock).not.toHaveBeenCalled()
})
it('rejects failed CAPTCHA, wrong hostname/action, and verifier outages',async()=>{
  for(const result of [{success:false},{success:true,hostname:'wrong',action:'country_waitlist'},{success:true,hostname:'app.tshelo.com',action:'wrong'}]) {
    fetchMock.mockResolvedValue(Response.json(result))
    expect((await POST(request())).status).toBe(400)
  }
  fetchMock.mockRejectedValue(new Error('network'))
  expect((await POST(request())).status).toBe(503)
  expect(rpc.mock.calls.every(([name])=>name==='consume_country_waitlist_limits')).toBe(true)
})
it('submits normalized contacts only after successful CAPTCHA',async()=>{
  const result=await POST(request())
  expect(result.status).toBe(200)
  expect(rpc).toHaveBeenLastCalledWith('submit_country_waitlist',{p_country:'KEN',p_email:'test@example.com',p_phone:null})
  expect(await result.json()).toEqual({message:'Your request has been received.'})
})
it('protects cleanup with a secret and calls only the purge RPC',async()=>{
  expect((await cleanup(new Request('https://app.test',{method:'POST'}))).status).toBe(403)
  expect((await cleanup(new Request('https://app.test',{method:'POST',headers:{authorization:'Bearer cleanup-secret'}}))).status).toBe(204)
  expect(rpc).toHaveBeenLastCalledWith('purge_expired_country_waitlist')
})
