const FORMSPREE_ENDPOINT = "https://formspree.io/f/mjglvdey";
const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function redirectWithStatus(url, status) {
    return Response.redirect(`${url}?status=${status}`, 303);
}

export async function onRequestPost({ request, env }) {
    const formData = await request.formData();
    const token = formData.get("cf-turnstile-response");
    const origin = new URL(request.url).origin;
    const referrer = request.headers.get("Referer") || origin;
    const redirectUrl = new URL(referrer);
    const returnUrl = redirectUrl.origin === origin ? redirectUrl.origin + redirectUrl.pathname : origin;

    if (!env.TURNSTILE_SECRET_KEY) {
        return new Response("Turnstile secret key is not configured.", { status: 500 });
    }

    if (!token) {
        return redirectWithStatus(returnUrl, "verification-missing");
    }

    const verifyData = new FormData();
    verifyData.append("secret", env.TURNSTILE_SECRET_KEY);
    verifyData.append("response", token);
    verifyData.append("remoteip", request.headers.get("CF-Connecting-IP") || "");

    const verifyResponse = await fetch(TURNSTILE_VERIFY_URL, {
        method: "POST",
        body: verifyData,
    });
    const verifyResult = await verifyResponse.json();

    if (!verifyResult.success) {
        return redirectWithStatus(returnUrl, "verification-failed");
    }

    formData.delete("cf-turnstile-response");

    const formspreeResponse = await fetch(env.FORMSPREE_ENDPOINT || FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: {
            Accept: "application/json",
        },
        body: formData,
    });

    if (!formspreeResponse.ok) {
        return redirectWithStatus(returnUrl, "send-failed");
    }

    return redirectWithStatus(returnUrl, "sent");
}

export function onRequestGet() {
    return new Response("Method Not Allowed", {
        status: 405,
        headers: {
            Allow: "POST",
        },
    });
}
