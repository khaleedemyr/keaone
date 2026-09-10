New {{ $inquiry->kind === 'quote' ? 'quote' : 'contact' }} inquiry for {{ $storefront->title ?: 'your storefront' }}

Name: {{ $inquiry->name }}
Email: {{ $inquiry->email }}
@if ($inquiry->phone)
Phone: {{ $inquiry->phone }}
@endif
@if ($inquiry->subject)
Subject: {{ $inquiry->subject }}
@endif

Message:
{{ $inquiry->message }}

—
Received at {{ optional($inquiry->created_at)->toDateTimeString() }}
