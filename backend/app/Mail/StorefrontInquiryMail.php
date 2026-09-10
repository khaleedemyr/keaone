<?php

namespace App\Mail;

use App\Models\Storefront;
use App\Models\StorefrontInquiry;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class StorefrontInquiryMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Storefront $storefront,
        public StorefrontInquiry $inquiry,
    ) {}

    public function envelope(): Envelope
    {
        $kind = $this->inquiry->kind === StorefrontInquiry::KIND_QUOTE ? 'Quote' : 'Contact';
        $site = trim((string) ($this->storefront->title ?: 'Storefront'));

        return new Envelope(
            subject: "[{$site}] New {$kind} inquiry from {$this->inquiry->name}",
            replyTo: [$this->inquiry->email],
        );
    }

    public function content(): Content
    {
        return new Content(
            text: 'mail.storefront-inquiry',
        );
    }
}
