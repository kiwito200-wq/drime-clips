'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-[#08CF65] rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">Drime Sign</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-gray-600 hover:text-gray-900 font-medium">
              Log in
            </Link>
            <Link href="/dashboard" className="btn-primary">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-7xl mx-auto px-6 py-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto"
        >
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Sign documents{' '}
            <span className="text-[#08CF65]">securely</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10">
            The modern way to get signatures. Upload, send, and sign documents 
            with cryptographic verification.
          </p>
          
          <div className="flex items-center justify-center gap-4">
            <Link href="/dashboard" className="btn-primary text-lg px-8 py-4">
              Start Signing Free
            </Link>
            <Link href="#features" className="btn-outline text-lg px-8 py-4">
              Learn More
            </Link>
          </div>
        </motion.div>

        {/* Features */}
        <div id="features" className="mt-32 grid md:grid-cols-3 gap-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card p-8"
          >
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Upload Documents</h3>
            <p className="text-gray-600">
              Upload your PDF documents and prepare them for signing in seconds.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="card p-8"
          >
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Place Fields</h3>
            <p className="text-gray-600">
              Add signature, text, and date fields exactly where you need them.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="card p-8"
          >
            <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
              <svg className="w-7 h-7 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">Send & Track</h3>
            <p className="text-gray-600">
              Send to recipients and track signature status in real-time.
            </p>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white mt-32">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <p className="text-gray-500">© 2026 Drime Sign. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Part of</span>
              <span className="font-semibold text-gray-700">Drime</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
