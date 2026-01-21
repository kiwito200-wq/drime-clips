/**
 * Drime Sign - Certificate Generation & Management
 * 
 * This module generates X.509 certificates for digitally signing PDFs.
 * Certificate chain: Drime Root CA → Drime Sub-CA → Drime Sign Certificate
 * 
 * Based on DocuSeal's implementation pattern.
 */

import * as forge from 'node-forge'
import crypto from 'crypto'

const pki = forge.pki

// Type alias for RSA private key
type RSAPrivateKey = forge.pki.rsa.PrivateKey

// Certificate configuration
const CERT_CONFIG = {
  organization: 'Drime',
  organizationUnit: 'Drime Sign',
  country: 'FR',
  state: 'Ile-de-France',
  locality: 'Paris',
  commonNameRoot: 'Drime Root CA',
  commonNameSub: 'Drime Sub-CA',
  commonNameSign: 'Drime Sign',
  validityYears: 100,
  keySize: 2048,
}

export interface DrimeCertificate {
  certificate: string // PEM format
  privateKey: string // PEM format
  certificateChain: string[] // [subCA, rootCA] in PEM format
}

export interface DrimeCertificateStore {
  rootCA: {
    certificate: string
    privateKey: string
  }
  subCA: {
    certificate: string
    privateKey: string
  }
  sign: {
    certificate: string
    privateKey: string
  }
}

/**
 * Generate a complete certificate chain for Drime Sign
 */
export function generateCertificateChain(): DrimeCertificateStore {
  // 1. Generate Root CA
  const rootCA = generateRootCA()
  
  // 2. Generate Sub-CA (signed by Root CA)
  const subCA = generateSubCA(rootCA)
  
  // 3. Generate Signing Certificate (signed by Sub-CA)
  const signCert = generateSigningCertificate(subCA)
  
  return {
    rootCA: {
      certificate: pki.certificateToPem(rootCA.certificate),
      privateKey: pki.privateKeyToPem(rootCA.privateKey),
    },
    subCA: {
      certificate: pki.certificateToPem(subCA.certificate),
      privateKey: pki.privateKeyToPem(subCA.privateKey),
    },
    sign: {
      certificate: pki.certificateToPem(signCert.certificate),
      privateKey: pki.privateKeyToPem(signCert.privateKey),
    },
  }
}

/**
 * Generate Root CA certificate
 */
function generateRootCA() {
  const keys = pki.rsa.generateKeyPair(CERT_CONFIG.keySize)
  const cert = pki.createCertificate()
  
  cert.publicKey = keys.publicKey
  cert.serialNumber = generateSerialNumber()
  
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(
    cert.validity.notBefore.getFullYear() + CERT_CONFIG.validityYears
  )
  
  const attrs = [
    { name: 'commonName', value: CERT_CONFIG.commonNameRoot },
    { name: 'organizationName', value: CERT_CONFIG.organization },
    { name: 'countryName', value: CERT_CONFIG.country },
  ]
  
  cert.setSubject(attrs)
  cert.setIssuer(attrs) // Self-signed
  
  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: true,
      critical: true,
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      cRLSign: true,
      critical: true,
    },
    {
      name: 'subjectKeyIdentifier',
    },
  ])
  
  // Self-sign with SHA-256
  cert.sign(keys.privateKey, forge.md.sha256.create())
  
  return { certificate: cert, privateKey: keys.privateKey }
}

/**
 * Generate Sub-CA certificate (intermediate CA)
 */
function generateSubCA(rootCA: { certificate: forge.pki.Certificate; privateKey: RSAPrivateKey }) {
  const keys = pki.rsa.generateKeyPair(CERT_CONFIG.keySize)
  const cert = pki.createCertificate()
  
  cert.publicKey = keys.publicKey
  cert.serialNumber = generateSerialNumber()
  
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(
    cert.validity.notBefore.getFullYear() + CERT_CONFIG.validityYears
  )
  
  const subjectAttrs = [
    { name: 'commonName', value: CERT_CONFIG.commonNameSub },
    { name: 'organizationName', value: CERT_CONFIG.organization },
    { name: 'countryName', value: CERT_CONFIG.country },
  ]
  
  cert.setSubject(subjectAttrs)
  cert.setIssuer(rootCA.certificate.subject.attributes)
  
  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: true,
      critical: true,
    },
    {
      name: 'keyUsage',
      keyCertSign: true,
      cRLSign: true,
      critical: true,
    },
    {
      name: 'subjectKeyIdentifier',
    },
    {
      name: 'authorityKeyIdentifier',
      keyIdentifier: true,
    },
  ])
  
  // Sign with Root CA's private key
  cert.sign(rootCA.privateKey, forge.md.sha256.create())
  
  return { certificate: cert, privateKey: keys.privateKey }
}

/**
 * Generate end-entity signing certificate
 */
function generateSigningCertificate(subCA: { certificate: forge.pki.Certificate; privateKey: RSAPrivateKey }) {
  const keys = pki.rsa.generateKeyPair(CERT_CONFIG.keySize)
  const cert = pki.createCertificate()
  
  cert.publicKey = keys.publicKey
  cert.serialNumber = generateSerialNumber()
  
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date()
  cert.validity.notAfter.setFullYear(
    cert.validity.notBefore.getFullYear() + CERT_CONFIG.validityYears
  )
  
  const subjectAttrs = [
    { name: 'commonName', value: CERT_CONFIG.commonNameSign },
    { name: 'organizationName', value: CERT_CONFIG.organization },
    { name: 'organizationalUnitName', value: CERT_CONFIG.organizationUnit },
    { name: 'countryName', value: CERT_CONFIG.country },
    { name: 'stateOrProvinceName', value: CERT_CONFIG.state },
    { name: 'localityName', value: CERT_CONFIG.locality },
  ]
  
  cert.setSubject(subjectAttrs)
  cert.setIssuer(subCA.certificate.subject.attributes)
  
  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: false,
      critical: true,
    },
    {
      name: 'keyUsage',
      digitalSignature: true,
      nonRepudiation: true,
      critical: true,
    },
    {
      name: 'extKeyUsage',
      emailProtection: true,
      // Document signing
    },
    {
      name: 'subjectKeyIdentifier',
    },
    {
      name: 'authorityKeyIdentifier',
      keyIdentifier: true,
    },
  ])
  
  // Sign with Sub-CA's private key
  cert.sign(subCA.privateKey, forge.md.sha256.create())
  
  return { certificate: cert, privateKey: keys.privateKey }
}

/**
 * Generate a random serial number
 */
function generateSerialNumber(): string {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Get or create the Drime certificate
 * In production, this should be stored securely and reused
 */
let cachedCertificates: DrimeCertificateStore | null = null

export function getDrimeCertificates(): DrimeCertificateStore {
  // Check for environment-provided certificates
  if (process.env.DRIME_ROOT_CA_CERT && process.env.DRIME_SIGN_CERT && process.env.DRIME_SIGN_KEY) {
    return {
      rootCA: {
        certificate: process.env.DRIME_ROOT_CA_CERT,
        privateKey: process.env.DRIME_ROOT_CA_KEY || '',
      },
      subCA: {
        certificate: process.env.DRIME_SUB_CA_CERT || '',
        privateKey: process.env.DRIME_SUB_CA_KEY || '',
      },
      sign: {
        certificate: process.env.DRIME_SIGN_CERT,
        privateKey: process.env.DRIME_SIGN_KEY,
      },
    }
  }
  
  // Use cached or generate new
  if (!cachedCertificates) {
    console.log('[Drime Cert] Generating new certificate chain...')
    cachedCertificates = generateCertificateChain()
    console.log('[Drime Cert] Certificate chain generated successfully')
  }
  
  return cachedCertificates
}

/**
 * Get certificate for PDF signing
 */
export function getSigningCertificate(): DrimeCertificate {
  const certs = getDrimeCertificates()
  
  return {
    certificate: certs.sign.certificate,
    privateKey: certs.sign.privateKey,
    certificateChain: [certs.subCA.certificate, certs.rootCA.certificate],
  }
}

/**
 * Export certificate chain as PKCS#12 (PFX) for compatibility
 */
export function exportAsPKCS12(password: string = ''): string {
  const certs = getDrimeCertificates()
  
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
    pki.privateKeyFromPem(certs.sign.privateKey),
    [
      pki.certificateFromPem(certs.sign.certificate),
      pki.certificateFromPem(certs.subCA.certificate),
      pki.certificateFromPem(certs.rootCA.certificate),
    ],
    password,
    {
      algorithm: '3des', // Compatible with most tools
    }
  )
  
  return forge.util.encode64(forge.asn1.toDer(p12Asn1).getBytes())
}
