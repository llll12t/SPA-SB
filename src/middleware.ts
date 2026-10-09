import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const liffState = request.nextUrl.searchParams.get('liff.state');
    if (liffState) {
        let target = decodeURIComponent(liffState.trim());
        if (!target.startsWith('/')) {
            target = '/' + target;
        }
        const redirectUrl = new URL(target, request.url);
        return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
}

export const config = {
    // ดักจับเฉพาะหน้าแรก (/) ซึ่งเป็น Endpoint URL หลักของ LINE LIFF
    matcher: ['/'],
};
