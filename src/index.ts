/**
 * Backend Cloudflare Worker - Rafa Platform
 * Hanya mengekspos endpoint root ("/") yang mengembalikan "Hello World"
 */

export interface Env {
	AI?: any;
	DATABASE_URL?: string;
}

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders });
		}

		const url = new URL(request.url);

		if (url.pathname === "/" || url.pathname === "") {
			return new Response("Hello World", {
				status: 200,
				headers: {
					"Content-Type": "text/plain; charset=utf-8",
					...corsHeaders,
				},
			});
		}

		return new Response("Not Found", {
			status: 404,
			headers: corsHeaders,
		});
	},
} satisfies ExportedHandler<Env>;
