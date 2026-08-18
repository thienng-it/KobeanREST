import type { GrpcProtoSchema, GrpcServiceDefinition, GrpcMethodDefinition, GrpcMessageType, GrpcMessageField } from '../types';

export function parseProtoSchema(protoText: string): GrpcProtoSchema {
  const schema: GrpcProtoSchema = {
    services: [],
    messages: {},
    rawProto: protoText,
  };

  const lines = protoText.split('\n');
  let currentPackage = '';
  let currentService: GrpcServiceDefinition | null = null;
  let currentMessage: GrpcMessageType | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    // Strip comments
    const line = rawLine.replace(/\/\/.*$/, '').trim();
    if (!line) continue;

    // Package declaration
    const pkgMatch = line.match(/^package\s+([a-zA-Z0-9_.]+)\s*;/);
    if (pkgMatch) {
      currentPackage = pkgMatch[1];
      continue;
    }

    // Service start
    const serviceMatch = line.match(/^service\s+([a-zA-Z0-9_]+)\s*\{/);
    if (serviceMatch) {
      currentService = {
        name: currentPackage ? `${currentPackage}.${serviceMatch[1]}` : serviceMatch[1],
        package: currentPackage,
        methods: [],
      };
      schema.services.push(currentService);
      continue;
    }

    // RPC method inside service
    if (currentService) {
      const rpcMatch = line.match(/^rpc\s+([a-zA-Z0-9_]+)\s*\(\s*(stream\s+)?([a-zA-Z0-9_.]+)\s*\)\s*returns\s*\(\s*(stream\s+)?([a-zA-Z0-9_.]+)\s*\)/);
      if (rpcMatch) {
        const [, name, reqStream, reqType, resStream, resType] = rpcMatch;
        const requestStream = !!reqStream;
        const responseStream = !!resStream;
        let rpcType: GrpcMethodDefinition['rpcType'] = 'unary';
        if (requestStream && responseStream) rpcType = 'bidi-streaming';
        else if (responseStream) rpcType = 'server-streaming';
        else if (requestStream) rpcType = 'client-streaming';

        currentService.methods.push({
          name,
          requestType: reqType.trim(),
          responseType: resType.trim(),
          requestStream,
          responseStream,
          rpcType,
        });
        continue;
      }

      if (line === '}' || line.startsWith('}')) {
        currentService = null;
        continue;
      }
    }

    // Message start
    const messageMatch = line.match(/^message\s+([a-zA-Z0-9_]+)\s*\{/);
    if (messageMatch) {
      const msgName = messageMatch[1];
      currentMessage = {
        name: msgName,
        fields: [],
      };
      schema.messages[msgName] = currentMessage;
      continue;
    }

    // Message field inside message
    if (currentMessage) {
      const fieldMatch = line.match(/^(repeated\s+|optional\s+)?([a-zA-Z0-9_.]+)\s+([a-zA-Z0-9_]+)\s*=\s*(\d+)\s*;/);
      if (fieldMatch) {
        const [, modifier, type, name, numStr] = fieldMatch;
        const isRepeated = modifier?.trim() === 'repeated';
        const isOptional = modifier?.trim() === 'optional';
        currentMessage.fields.push({
          name,
          type,
          number: parseInt(numStr, 10),
          repeated: isRepeated,
          optional: isOptional,
        });
        continue;
      }

      if (line === '}' || line.startsWith('}')) {
        currentMessage = null;
        continue;
      }
    }
  }

  return schema;
}

export function generateSampleMessageJson(messageType: string, schema?: GrpcProtoSchema): string {
  // Strip package prefix if present
  const baseName = messageType.includes('.') ? messageType.split('.').pop()! : messageType;

  if (schema && schema.messages[baseName]) {
    const msg = schema.messages[baseName];
    const obj: Record<string, any> = {};

    for (const field of msg.fields) {
      let sampleVal: any = '';
      const t = field.type.toLowerCase();

      if (t === 'string') sampleVal = `${field.name}_value`;
      else if (t === 'int32' || t === 'int64' || t === 'uint32' || t === 'uint64' || t === 'sint32' || t === 'sint64') sampleVal = 0;
      else if (t === 'float' || t === 'double') sampleVal = 0.0;
      else if (t === 'bool') sampleVal = true;
      else if (t === 'bytes') sampleVal = 'aGVsbG8=';
      else if (schema.messages[field.type]) {
        // Nested message
        try {
          sampleVal = JSON.parse(generateSampleMessageJson(field.type, schema));
        } catch {
          sampleVal = {};
        }
      } else {
        sampleVal = `${field.name}_value`;
      }

      if (field.repeated) {
        obj[field.name] = [sampleVal];
      } else {
        obj[field.name] = sampleVal;
      }
    }

    return JSON.stringify(obj, null, 2);
  }

  // Fallback realistic placeholder
  return JSON.stringify({
    message: "Hello from KobeanREST gRPC!",
  }, null, 2);
}

export const SAMPLE_PROTO_DEFINITIONS: Array<{ label: string; proto: string }> = [
  {
    label: "Greeter Service (Hello World)",
    proto: `syntax = "proto3";

package helloworld;

service Greeter {
  rpc SayHello (HelloRequest) returns (HelloReply);
  rpc SayHelloStream (HelloRequest) returns (stream HelloReply);
}

message HelloRequest {
  string name = 1;
}

message HelloReply {
  string message = 1;
}`
  },
  {
    label: "Echo Service (Unary & Streaming)",
    proto: `syntax = "proto3";

package echo;

service EchoService {
  rpc Echo (EchoRequest) returns (EchoResponse);
  rpc ServerStreamingEcho (EchoRequest) returns (stream EchoResponse);
  rpc ClientStreamingEcho (stream EchoRequest) returns (EchoResponse);
  rpc FullDuplexEcho (stream EchoRequest) returns (stream EchoResponse);
}

message EchoRequest {
  string message = 1;
  int32 sequence_number = 2;
}

message EchoResponse {
  string message = 1;
  int32 sequence_number = 2;
}`
  },
  {
    label: "Product Catalog Service",
    proto: `syntax = "proto3";

package products;

service ProductService {
  rpc GetProduct (GetProductRequest) returns (Product);
  rpc AddProduct (AddProductRequest) returns (Product);
  rpc ListProducts (ListProductsRequest) returns (stream Product);
}

message GetProductRequest {
  string product_id = 1;
}

message AddProductRequest {
  string name = 1;
  double price = 2;
  repeated string tags = 3;
}

message ListProductsRequest {
  int32 page_size = 1;
  string page_token = 2;
}

message Product {
  string id = 1;
  string name = 2;
  double price = 3;
  repeated string tags = 4;
  int64 created_at = 5;
}`
  }
];
