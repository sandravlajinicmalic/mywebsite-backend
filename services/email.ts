import nodemailer from 'nodemailer'
import { supabase } from '../config/supabase.js'

interface EmailOptions {
  to: string
  subject: string
  html: string
}

/**
 * Email service for sending emails
 */
class EmailService {
  private transporter: nodemailer.Transporter | null = null

  /**
   * Initialize email transporter
   */
  private async initializeTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) {
      return this.transporter
    }

    // Check if SMTP configuration is present
    const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com'
    const smtpPort = parseInt(process.env.SMTP_PORT || '587')
    const smtpSecure = process.env.SMTP_SECURE === 'true'
    const smtpUser = process.env.SMTP_USER
    const smtpPassword = process.env.SMTP_PASSWORD

    if (!smtpUser || !smtpPassword) {
      console.error('❌ SMTP configuration missing!')
      console.error('SMTP_USER:', smtpUser ? '✓ Set' : '✗ Missing')
      console.error('SMTP_PASSWORD:', smtpPassword ? '✓ Set' : '✗ Missing')
      throw new Error('SMTP configuration is incomplete. Please set SMTP_USER and SMTP_PASSWORD environment variables.')
    }

    console.log('📧 Initializing SMTP transporter (fallback for local development)...')
    console.log('SMTP Host:', smtpHost)
    console.log('SMTP Port:', smtpPort)
    console.log('SMTP Secure:', smtpSecure)
    console.log('SMTP User:', smtpUser)

    // Configuration for email service (Gmail, SMTP, etc.)
    // You can use Gmail, SendGrid, or any SMTP service
    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      // Add connection timeout and better error handling
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
      // Debug mode for better error messages
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development',
    })

    // Verify connection (skip on production/Render to avoid timeout issues)
    if (process.env.NODE_ENV === 'development') {
      try {
        await this.transporter.verify()
        console.log('✓ SMTP connection verified successfully')
      } catch (error: any) {
        console.error('❌ SMTP connection verification failed!')
        console.error('Error details:', {
          code: error.code,
          command: error.command,
          response: error.response,
          responseCode: error.responseCode,
          message: error.message,
        })
        // Don't throw in development, just warn
        console.warn('⚠️  SMTP verification failed, but will attempt to send anyway')
      }
    }

    return this.transporter
  }

  /**
   * Get email template from Supabase Storage
   * @param templateName - Template file name (e.g. 'welcome-email.html')
   * @param variables - Variables to replace in template (e.g. { nickname: 'John', email: 'john@example.com' })
   * @returns HTML string of template with replaced variables
   */
  async getTemplateFromStorage(
    templateName: string,
    variables: Record<string, string> = {}
  ): Promise<string> {
    try {
      // Get template from Supabase Storage
      // Bucket: 'email-templates', File: templateName
      const { data, error } = await supabase.storage
        .from('email-templates')
        .download(templateName)

      if (error) {
        console.error('Error downloading template from Supabase Storage:', error)
        throw new Error(`Failed to load email template: ${templateName}`)
      }

      // Convert Blob to text
      const templateText = await data.text()

      // Replace variables in template
      // Format: {{variableName}}
      let html = templateText
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g')
        html = html.replace(regex, value)
      }

      return html
    } catch (error) {
      console.error('Error processing email template:', error)
      throw error
    }
  }

  /**
   * Send email using Resend API (preferred for Render)
   */
  private async sendEmailViaResend(options: EmailOptions): Promise<void> {
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }

    // Get from email, but use onboarding@resend.dev if it's from a non-verified domain (like gmail.com)
    let fromEmail = process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || 'onboarding@resend.dev'
    
    // Check if email is from a common non-verifiable domain (gmail, yahoo, outlook, etc.)
    const nonVerifiableDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com']
    const emailDomain = fromEmail.split('@')[1]?.toLowerCase()
    
    if (emailDomain && nonVerifiableDomains.includes(emailDomain)) {
      console.log(`⚠️  Email domain ${emailDomain} is not verifiable in Resend, using onboarding@resend.dev`)
      fromEmail = 'onboarding@resend.dev'
    }
    
    console.log('📧 Sending email via Resend API...')
    console.log('From:', fromEmail)
    console.log('To:', options.to)
    console.log('Subject:', options.subject)

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string; name?: string }
      
      // If domain verification error, try with onboarding@resend.dev
      if (response.status === 403 && errorData.message?.includes('domain is not verified')) {
        console.log('⚠️  Domain verification error, retrying with onboarding@resend.dev...')
        return this.sendEmailViaResendWithFrom(options, 'onboarding@resend.dev')
      }
      
      // If test email restriction (can only send to verified email in test mode)
      if (response.status === 403 && errorData.message?.includes('testing emails')) {
        const errorMsg = `Resend API error: Domain is pending verification. You can only send emails to your verified email address in test mode. Please wait for domain verification or verify your domain at https://resend.com/domains`
        console.error('❌', errorMsg)
        throw new Error(errorMsg)
      }
      
      throw new Error(`Resend API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
    }

    const data = await response.json() as { id?: string }
    console.log(`✓ Email sent successfully via Resend to ${options.to}`)
    if (data.id) {
      console.log('Resend ID:', data.id)
    }
  }

  /**
   * Helper method to send email with specific from address
   */
  private async sendEmailViaResendWithFrom(options: EmailOptions, fromEmail: string): Promise<void> {
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Resend API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
    }

    const data = await response.json() as { id?: string }
    console.log(`✓ Email sent successfully via Resend to ${options.to}`)
    if (data.id) {
      console.log('Resend ID:', data.id)
    }
  }

  /**
   * Send email
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      console.log(`📧 Attempting to send email to ${options.to}...`)
      
      // Try Resend API first (works on Render)
      if (process.env.RESEND_API_KEY) {
        try {
          await this.sendEmailViaResend(options)
          return
        } catch (resendError: any) {
          // Don't fallback to SMTP on Render (SMTP is blocked)
          // Only use SMTP fallback in local development
          if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
            console.error('❌ Resend API failed on Render/production. SMTP is not available. Error:', resendError.message)
            throw resendError // Re-throw to prevent SMTP fallback
          }
          console.error('❌ Resend API failed, falling back to SMTP (local dev only):', resendError.message)
          // Fall through to SMTP only in local development
        }
      }

      // Fallback to SMTP (for local development only)
      const transporter = await this.initializeTransporter()

      const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER
      if (!fromEmail) {
        throw new Error('SMTP_FROM or SMTP_USER environment variable is not set')
      }

      const mailOptions = {
        from: fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html,
      }

      console.log('Mail options:', {
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject,
      })

      const info = await transporter.sendMail(mailOptions)

      console.log(`✓ Email sent successfully to ${options.to}`)
      console.log('Message ID:', info.messageId)
      console.log('Response:', info.response)
    } catch (error: any) {
      console.error('❌ Error sending email:', {
        to: options.to,
        subject: options.subject,
        error: {
          code: error.code,
          command: error.command,
          response: error.response,
          responseCode: error.responseCode,
          message: error.message,
          stack: error.stack,
        },
      })
      throw error
    }
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(email: string, nickname: string): Promise<void> {
    try {
      // Get template from Supabase Storage
      const html = await this.getTemplateFromStorage('welcome-email.html', {
        nickname,
        email,
      })

      // Send email
      await this.sendEmail({
        to: email,
        subject: 'Welcome to MeowCrafts! 🎉',
        html,
      })
    } catch (error) {
      console.error('Error sending welcome email:', error)
      // Don't throw error - we don't want login to fail because of email issues
      // Just log the error
    }
  }

  /**
   * Send delete account email to user whose profile was deleted
   */
  async sendDeleteAccountEmail(email: string, nickname: string): Promise<void> {
    try {
      // Get template from Supabase Storage
      const html = await this.getTemplateFromStorage('delete-account.html', {
        nickname,
        email,
      })

      // Send email
      await this.sendEmail({
        to: email,
        subject: 'Account Deleted - MeowCrafts',
        html,
      })
    } catch (error) {
      console.error('Error sending delete account email:', error)
      // Don't throw error - we don't want delete to fail because of email issues
      // Just log the error
    }
  }

  /**
   * Send forgot nickname email to user
   */
  async sendForgotNicknameEmail(email: string, nickname: string): Promise<void> {
    try {
      // Get template from Supabase Storage
      const html = await this.getTemplateFromStorage('forgot-nickname.html', {
        nickname,
        email,
      })

      // Send email
      await this.sendEmail({
        to: email,
        subject: 'Your Nickname - MeowCrafts',
        html,
      })
    } catch (error) {
      console.error('Error sending forgot nickname email:', error)
      // Don't throw error - we don't want request to fail because of email issues
      // Just log the error
    }
  }

  /**
   * Send contact form message email to admin
   */
  async sendContactFormEmail(name: string, email: string, message: string): Promise<void> {
    try {
      // Get admin email from environment variable (SMTP_USER or SMTP_FROM)
      const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER
      
      if (!adminEmail) {
        console.error('Admin email not configured. Set ADMIN_EMAIL, SMTP_FROM, or SMTP_USER environment variable.')
        return
      }

      // Try to get template from Supabase Storage, fallback to simple HTML if not found
      let html: string
      try {
        html = await this.getTemplateFromStorage('contact-form.html', {
          name,
          email,
          message,
        })
      } catch (templateError) {
        // If template doesn't exist, use simple HTML
        console.log('Contact form template not found, using simple HTML')
        html = this.getContactFormEmailHTML(name, email, message)
      }

      // Send email to admin
      await this.sendEmail({
        to: adminEmail,
        subject: `New Contact Form Message from ${name}`,
        html,
      })
    } catch (error) {
      console.error('Error sending contact form email:', error)
      // Don't throw error - we don't want contact form submission to fail because of email issues
      // Just log the error
    }
  }

  /**
   * Generate simple HTML for contact form email (fallback if template doesn't exist)
   */
  private getContactFormEmailHTML(name: string, email: string, message: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #06B6D4;
              color: white;
              padding: 20px;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background-color: #f9f9f9;
              padding: 20px;
              border: 1px solid #ddd;
              border-top: none;
              border-radius: 0 0 8px 8px;
            }
            .field {
              margin-bottom: 15px;
            }
            .label {
              font-weight: bold;
              color: #06B6D4;
              margin-bottom: 5px;
            }
            .value {
              padding: 10px;
              background-color: white;
              border-radius: 4px;
              border: 1px solid #ddd;
            }
            .message {
              white-space: pre-wrap;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>New Contact Form Message</h2>
          </div>
          <div class="content">
            <div class="field">
              <div class="label">From:</div>
              <div class="value">${name} (${email})</div>
            </div>
            <div class="field">
              <div class="label">Message:</div>
              <div class="value message">${message}</div>
            </div>
          </div>
        </body>
      </html>
    `
  }
}

export const emailService = new EmailService()

