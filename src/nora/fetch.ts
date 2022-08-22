import { Agent, request } from 'https';

interface FetchOptions {
    method: 'POST';
    agent?: Agent;
    headers?: Record<string, string>;
    body: object;
}

export interface FetchResponse<T> {
    status: number;
    ok: boolean;
    json(): Promise<T>;
    text(): Promise<string>;
}

export function fetch<T = any>(url: string, { method, agent, headers, body }: FetchOptions): Promise<FetchResponse<T>> {
    return new Promise<FetchResponse<T>>((resolve, reject) => {
        const uri = new URL(url);
        const bodyContent = JSON.stringify(body);
        const req = request({
            hostname: uri.hostname,
            path: uri.pathname + uri.search,
            method,
            agent,
            headers:
            {
                ...headers,
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'content-type': 'application/json',
                // eslint-disable-next-line @typescript-eslint/naming-convention
                'content-length': bodyContent.length,
            },
        }, res => {
            const responseText = new Promise<string>((resolveResponse, rejectResponse) => {
                const data: Uint8Array[] = [];
                res.on('data', chunk => {
                    data.push(chunk);
                });
                res.on('end', () => {
                    const text = Buffer.concat(data).toString();
                    resolveResponse(text);
                });
                res.on('error', err => {
                    rejectResponse(err);
                });
            });

            const status = res.statusCode ?? 0;

            resolve({
                status,
                ok: Math.floor(status / 100) < 4,
                text: () => responseText,
                json: () => responseText.then(v => JSON.parse(v)),
            });
        });

        req.on('error', error => {
            reject(error);
        });

        req.write(bodyContent);
        req.end();
    });
}
