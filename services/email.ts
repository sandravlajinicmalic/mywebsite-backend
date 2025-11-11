import nodemailer from 'nodemailer'
import { supabase } from '../config/supabase.js'

interface EmailOptions {
  to: string
  subject: string
  html: string
}

/**
 * Email service za slanje emailova
 */
class EmailService {
  private transporter: nodemailer.Transporter | null = null

  /**
   * Inicijalizira email transporter
   */
  private async initializeTransporter(): Promise<nodemailer.Transporter> {
    if (this.transporter) {
      return this.transporter
    }

    // Konfiguracija za email servis (Gmail, SMTP, itd.)
    // Možeš koristiti Gmail, SendGrid, ili bilo koji SMTP servis
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true za 465, false za ostale portove
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })

    return this.transporter
  }

  /**
   * Dohvata email template iz Supabase Storage
   * @param templateName - Ime template fajla (npr. 'welcome-email.html')
   * @param variables - Varijable za zamjenu u template-u (npr. { nickname: 'John', email: 'john@example.com' })
   * @returns HTML string template-a sa zamijenjenim varijablama
   */
  async getTemplateFromStorage(
    templateName: string,
    variables: Record<string, string> = {}
  ): Promise<string> {
    try {
      // Dohvati template iz Supabase Storage
      // Bucket: 'email-templates', File: templateName
      const { data, error } = await supabase.storage
        .from('email-templates')
        .download(templateName)

      if (error) {
        console.error('Error downloading template from Supabase Storage:', error)
        throw new Error(`Failed to load email template: ${templateName}`)
      }

      // Konvertuj Blob u tekst
      const templateText = await data.text()

      // Zamijeni varijable u template-u
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
   * Šalje email
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
   * Šalje welcome email novom korisniku
   */
  async sendWelcomeEmail(email: string, nickname: string): Promise<void> {
    try {
      // Dohvati template iz Supabase Storage
      const html = await this.getTemplateFromStorage('welcome-email.html', {
        nickname,
        email,
      })

      // Pošalji email
      await this.sendEmail({
        to: email,
        subject: 'Welcome to MyWebsite! 🎉',
        html,
      })
    } catch (error) {
      console.error('Error sending welcome email:', error)
      // Ne baci error - ne želimo da login ne uspije zbog email problema
      // Samo loguj grešku
    }
  }
}

export const emailService = new EmailService()

