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

    // Configuration for email service (Gmail, SMTP, etc.)
    // You can use Gmail, SendGrid, or any SMTP service
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })

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
   * Send email
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const transporter = await this.initializeTransporter()

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        html: options.html,
      })

      console.log(`Email sent successfully to ${options.to}`)
    } catch (error) {
      console.error('Error sending email:', error)
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
        subject: 'Welcome to MyWebsite! 🎉',
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
        subject: 'Account Deleted - MyWebsite',
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
        subject: 'Your Nickname - MyWebsite',
        html,
      })
    } catch (error) {
      console.error('Error sending forgot nickname email:', error)
      // Don't throw error - we don't want request to fail because of email issues
      // Just log the error
    }
  }
}

export const emailService = new EmailService()

