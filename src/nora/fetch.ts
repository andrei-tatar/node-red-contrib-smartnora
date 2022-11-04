import { Agent, request } from 'https';
import { gzip } from 'zlib';

interface FetchOptions {
    method: 'POST' | 'GET';
    agent?: Agent;
    headers?: Record<string, string>;
    body?: object;
}

export interface FetchResponse<T> {
    status: number;
    ok: boolean;
    json(): Promise<T>;
    text(): Promise<string>;
}

export async function fetch<T = any>(url: string, { method, agent, headers, body }: FetchOptions): Promise<FetchResponse<T>> {
    const bodyContent = body ? await new Promise<Buffer>((resolve, reject) => {
        const jsonContent = Buffer.from(JSON.stringify(body));
        gzip(jsonContent, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    }) : null;

    return new Promise<FetchResponse<T>>((resolve, reject) => {
        const uri = new URL(url);
        const req = request({
            hostname: uri.hostname,
            path: uri.pathname + uri.search,
            port: uri.port,
            method,
            agent,
            headers:
            {
                ...headers,
                ...(bodyContent ? {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'content-type': 'application/json',
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'content-length': bodyContent.length,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    'content-encoding': 'gzip'
                } : {})
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

            const status = res.statusCode || 0;

            resolve({
                status,
                ok: Math.floor(status / 100) === 2,
                text: () => responseText,
                json: () => responseText.then(v => JSON.parse(v)),
            });
        });

        req.on('error', error => {
            reject(error);
        });

        if (bodyContent) {
            req.end(bodyContent);
        } else {
            req.end();
        }
    });
}
