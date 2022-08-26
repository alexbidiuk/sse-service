import * as http2 from 'http2';
import * as http from 'http';

type HttpRequest = http.IncomingMessage | http2.Http2ServerRequest;

type HttpResponse = (http.ServerResponse | http2.Http2ServerResponse) & http.OutgoingMessage;

type HttpResponseHeaders = http.OutgoingHttpHeaders | http2.OutgoingHttpHeaders;


interface SSEClientObjInterface {
  connections: HttpResponse[];
  meta?: Record<string, any>;
  clientId: string;
}

export { SSEClientObjInterface, HttpRequest, HttpResponse, HttpResponseHeaders };
