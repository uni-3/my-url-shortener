interface ThreatAlertProps {
    threatType?: string;
}

interface ThreatInfo {
    label: string;
    link: string;
    linkText: string;
}

function getThreatInfo(type?: string): ThreatInfo | null {
    switch (type) {
        case "MALWARE":
            return {
                label: "マルウェアの疑い",
                link: "https://developers.google.com/search/docs/monitor-debug/security/malware?hl=ja",
                linkText: "マルウェアについて詳しく知る",
            };
        case "SOCIAL_ENGINEERING":
            return {
                label: "フィッシング（詐欺広告）の疑い",
                link: "https://www.antiphishing.org/",
                linkText: "フィッシングについて詳しく知る",
            };
        case "UNWANTED_SOFTWARE":
            return {
                label: "好ましくないソフトウェアの疑い",
                link: "https://www.google.com/about/unwanted-software-policy.html",
                linkText: "Unwanted Software Policyについて詳しく知る",
            };
        default:
            return null;
    }
}

export default function ThreatAlert({ threatType }: ThreatAlertProps) {
    const threatInfo = getThreatInfo(threatType);

    if (!threatInfo) return null;

    return (
        <div className="mt-2 text-xs border-t border-red-100 pt-2 space-y-2">
            <p className="font-semibold text-red-700">{threatInfo.label}</p>
            <a
                href={threatInfo.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline block"
            >
                {threatInfo.linkText} →
            </a>
            <div className="text-[10px] text-muted-foreground mt-4 leading-relaxed">
                <a
                    href="https://www.google.com/intl/ja/help/safebrowsing-advisory.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium hover:underline text-foreground"
                >
                    Google が提供するアドバイス
                </a>
                <p className="mt-1">
                    Google は、安全ではないウェブ リソースに関する最も正確で最新の情報を提供するよう努めています。ただし、Google はその情報が包括的であり、エラーがないことを保証することはできません。
                </p>
            </div>
        </div>
    );
}
