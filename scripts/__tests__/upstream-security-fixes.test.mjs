import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const require = createRequire(import.meta.url)
const micromatchRequire = createRequire(require.resolve('micromatch'))
const braces = micromatchRequire('braces')
const signingRequire = createRequire(require.resolve('@expo/code-signing-certificates'))
const forge = signingRequire('node-forge')
const forgeSource = 'https://codeload.github.com/digitalbazaar/forge/tar.gz/85446800199c4995d3cd4b0ab5a8409df4455859'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

test('all locked copies use the reviewed sources, not vulnerable registry packages', () => {
  const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'))
  for (const name of ['braces', 'node-forge']) {
    const copies = Object.entries(lock.packages).filter(([key]) => key === `node_modules/${name}` || key.endsWith(`/node_modules/${name}`))
    assert.ok(copies.length)
    for (const [key, pkg] of copies) {
      if (name === 'braces') {
        assert.equal(pkg.name, '@tshelo/braces', key)
        assert.equal(pkg.resolved, 'file:vendor/tshelo-braces-3.0.3-patched.1.tgz', key)
      } else assert.equal(pkg.resolved, forgeSource, key)
      assert.ok(pkg.integrity, `${key} needs immutable archive integrity`)
    }
  }
  const installed = path.dirname(micromatchRequire.resolve('braces'))
  const vendor = path.join(root, 'vendor/braces')
  for (const file of ['index.js', ...readdirSync(path.join(vendor, 'lib')).map(file => `lib/${file}`)]) {
    assert.equal(hash(readFileSync(path.join(installed, file))), hash(readFileSync(path.join(vendor, file))), file)
  }
  const expected = JSON.parse(readFileSync(path.join(root, 'vendor/security-source-integrity.json'), 'utf8'))
  const forgeRoot = path.dirname(signingRequire.resolve('node-forge/package.json'))
  assert.equal(hash(readFileSync(path.join(forgeRoot, 'lib/rsa.js'))), expected.forgeRsaSha256)
  assert.equal(hash(readFileSync(path.join(root, 'vendor/tshelo-braces-3.0.3-patched.1.tgz'))), expected.bracesArchiveSha256)
})

test('deep patterns, cyclic ASTs and directly supplied deep ASTs fail before recursive traversal', () => {
  // A child timeout prevents a regression from hanging the CI process.
  execFileSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const {createRequire} = require('node:module');
    const b = createRequire(require.resolve('micromatch'))('braces');
    const bounded = fn => assert.throws(fn, e => e instanceof SyntaxError && /safe depth|acyclic/.test(e.message));
    for (const operation of ['parse','compile','expand','stringify']) {
      if (operation === 'parse') {
        for (const [left,right] of [['{','}'],['(',')']]) bounded(() => b.parse(left.repeat(4000)+'x'+right.repeat(4000)));
      } else {
        let ast={type:'text',value:'x'};
        for(let i=0;i<12000;i++)ast={type:'root',nodes:[ast]};
        bounded(() => b[operation](ast));
        const cyclic={type:'root',nodes:[]};cyclic.nodes.push(cyclic);
        bounded(() => b[operation](cyclic));
      }
    }
    for(const operation of ['compile','expand'])bounded(() => b[operation]('{'.repeat(4000)+'a,b'+'}'.repeat(4000)));
  `], { cwd: root, timeout: 5000, stdio: 'pipe' })
})

test('micromatch preserves normal build globs, ranges, escaping and shared acyclic nodes', () => {
  assert.deepEqual(braces.expand('src/{admin,mobile}/{1..3}.tsx'), ['src/admin/1.tsx','src/admin/2.tsx','src/admin/3.tsx','src/mobile/1.tsx','src/mobile/2.tsx','src/mobile/3.tsx'])
  assert.deepEqual(require('micromatch')(['src/a.ts','src/b.tsx','src/a.test.ts','README.md'], ['src/**/*.{ts,tsx}','!**/*.test.ts']), ['src/a.ts','src/b.tsx'])
  assert.deepEqual(braces.expand('a/\\{literal\\}'), ['a/{literal}'])
  const leaf={type:'text',value:'a'}
  assert.equal(braces.stringify({type:'root',nodes:[leaf,leaf]}),'aa')
  assert.doesNotThrow(() => braces.compile('{'.repeat(64)+'x,y'+'}'.repeat(64)))
})

const pem = generateKeyPairSync('rsa', { modulusLength: 1024, publicExponent: 3,
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' }, publicKeyEncoding: { type: 'pkcs1', format: 'pem' } })
const privateKey = forge.pki.privateKeyFromPem(pem.privateKey)
const publicKey = forge.pki.publicKeyFromPem(pem.publicKey)
const a = forge.asn1
const node = (type, constructed, value) => a.create(a.Class.UNIVERSAL,type,constructed,value)
const nullParameter = value => node(a.Type.NULL,false,value ?? '')
function verifyAlgorithm(algorithm, parameters, implementation=forge) {
  const md=implementation.md[algorithm].create();md.update('Tshelo DigestAlgorithm regression')
  const digest=md.digest().getBytes()
  const info=node(a.Type.SEQUENCE,true,[
    node(a.Type.SEQUENCE,true,[node(a.Type.OID,false,a.oidToDer(forge.pki.oids[algorithm]).getBytes()),...parameters]),
    node(a.Type.OCTETSTRING,false,digest),
  ])
  const signature=privateKey.sign(a.toDer(info).getBytes(),'NONE')
  return implementation.pki.publicKeyFromPem(pem.publicKey).verify(digest,signature)
}
for (const [name, parameters] of [
  ['extra child after NULL',[nullParameter(),node(a.Type.OCTETSTRING,false,'garbage')]],
  ['garbage instead of NULL',[node(a.Type.OCTETSTRING,false,'garbage')]],
  ['repeated NULL',[nullParameter(),nullParameter()]],
  ['nonempty NULL',[nullParameter('garbage')]],
  ['constructed NULL',[node(a.Type.NULL,true,[node(a.Type.OCTETSTRING,false,'garbage')])]],
]) test(`RSA rejects malformed DigestAlgorithm: ${name}`, () => {
  assert.throws(() => verifyAlgorithm('sha256',parameters), /valid RSASSA-PKCS1-v1_5 DigestInfo/)
})

test('RSA accepts canonical signatures and rejects altered messages', () => {
  for(const algorithm of ['sha1','sha256','sha512']) {
    assert.equal(verifyAlgorithm(algorithm,[]),true)
    assert.equal(verifyAlgorithm(algorithm,[nullParameter()]),true)
  }
  assert.equal(verifyAlgorithm('md5',[nullParameter()]),true)
  assert.throws(() => verifyAlgorithm('md5',[]),/Missing algorithm identifier NULL/)
  const md=forge.md.sha256.create();md.update('original');const signature=privateKey.sign(md)
  const other=forge.md.sha256.create();other.update('changed')
  assert.equal(publicKey.verify(other.digest().getBytes(),signature),false)
})

test('Expo certificate generation, validation and manifest signing still work', () => {
  const expo = require('@expo/code-signing-certificates')
  const keys=expo.generateKeyPair()
  const certificate=expo.generateSelfSignedCodeSigningCertificate({keyPair:keys,
    validityNotBefore:new Date(Date.now()-60000),validityNotAfter:new Date(Date.now()+86400000),commonName:'Disposable CI signer'})
  expo.validateSelfSignedCertificate(certificate,keys)
  const buffer=Buffer.from('disposable Expo manifest compatibility fixture')
  const signature=expo.signBufferRSASHA256AndVerify(keys.privateKey,certificate,buffer)
  assert.ok(Buffer.from(signature,'base64').length)
  const restored=expo.convertCertificatePEMToCertificate(expo.convertCertificateToCertificatePEM(certificate))
  assert.equal(restored.verify(restored),true)
})
