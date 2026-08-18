import type { MockRoute } from '../types';
import { SAMPLE_PROTO_DEFINITIONS, parseProtoSchema, generateSampleMessageJson } from './proto-parser';

export interface MockServerTemplate {
  id: string;
  name: string;
  category: 'rest' | 'grpc' | 'ai' | 'infra';
  description: string;
  icon: string;
  routes: Array<Omit<MockRoute, 'id'>>;
  proto?: string;
}

export const MOCK_SERVER_TEMPLATES: MockServerTemplate[] = [
  {
    id: 'ecommerce-rest',
    name: 'E-Commerce Store API',
    category: 'rest',
    description: 'Products catalog, shopping cart, categories, and checkout endpoints with realistic JSON data.',
    icon: '🛍️',
    routes: [
      {
        method: 'GET',
        path: '/api/v1/products',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 0,
        enabled: true,
        response_body: JSON.stringify({
          data: [
            { id: 'prod_101', name: 'Wireless Noise-Canceling Headphones', price: 299.99, category: 'Audio', in_stock: true, rating: 4.8 },
            { id: 'prod_102', name: 'Mechanical RGB Keyboard (Cherry MX)', price: 149.50, category: 'Accessories', in_stock: true, rating: 4.9 },
            { id: 'prod_103', name: 'Ultra-Wide 34" Curved Gaming Monitor', price: 649.00, category: 'Displays', in_stock: false, rating: 4.7 },
            { id: 'prod_104', name: 'Ergonomic Standing Desk Mat', price: 49.99, category: 'Furniture', in_stock: true, rating: 4.6 }
          ],
          pagination: { page: 1, limit: 10, total_items: 4, total_pages: 1 }
        }, null, 2),
      },
      {
        method: 'GET',
        path: '/api/v1/products/:id',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 0,
        enabled: true,
        response_body: JSON.stringify({
          id: 'prod_101',
          name: 'Wireless Noise-Canceling Headphones',
          description: 'Premium active noise cancellation with 40-hour battery life and spatial audio support.',
          price: 299.99,
          currency: 'USD',
          in_stock: true,
          inventory_count: 85,
          tags: ['wireless', 'bluetooth', 'anc', 'audio'],
          specs: { battery_hours: 40, weight_grams: 250, bluetooth_version: '5.3' }
        }, null, 2),
      },
      {
        method: 'POST',
        path: '/api/v1/products',
        status_code: 201,
        content_type: 'application/json',
        delay_ms: 50,
        enabled: true,
        response_body: JSON.stringify({
          success: true,
          message: 'Product created successfully',
          product_id: 'prod_new_' + Math.floor(Math.random() * 10000)
        }, null, 2),
      },
      {
        method: 'GET',
        path: '/api/v1/cart',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 0,
        enabled: true,
        response_body: JSON.stringify({
          cart_id: 'cart_8829',
          items: [
            { product_id: 'prod_101', quantity: 1, unit_price: 299.99, subtotal: 299.99 },
            { product_id: 'prod_104', quantity: 2, unit_price: 49.99, subtotal: 99.98 }
          ],
          subtotal: 399.97,
          discount: 20.00,
          shipping: 0.00,
          total: 379.97
        }, null, 2),
      },
      {
        method: 'POST',
        path: '/api/v1/checkout',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 120,
        enabled: true,
        response_body: JSON.stringify({
          order_id: 'ord_live_' + Math.floor(Math.random() * 900000 + 100000),
          status: 'confirmed',
          payment_status: 'paid',
          estimated_delivery: '2026-08-22',
          confirmation_code: 'KB-X981-22Q'
        }, null, 2),
      }
    ]
  },
  {
    id: 'ai-llm-rest',
    name: 'OpenAI / AI LLM Provider API',
    category: 'ai',
    description: 'Mock OpenAI-compatible /v1/chat/completions, /v1/models, and /v1/embeddings endpoints.',
    icon: '🤖',
    routes: [
      {
        method: 'POST',
        path: '/v1/chat/completions',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 200,
        enabled: true,
        response_body: JSON.stringify({
          id: 'chatcmpl-mock-' + Math.random().toString(36).slice(2, 10),
          object: 'chat.completion',
          created: 1723651200,
          model: 'gpt-4o',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: 'Hello! I am a simulated response from the KobeanREST Mock AI Server. How can I assist you with your API testing today?'
              },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 18,
            completion_tokens: 27,
            total_tokens: 45
          }
        }, null, 2),
      },
      {
        method: 'GET',
        path: '/v1/models',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 0,
        enabled: true,
        response_body: JSON.stringify({
          object: 'list',
          data: [
            { id: 'gpt-4o', object: 'model', created: 1715367049, owned_by: 'system' },
            { id: 'gpt-4o-mini', object: 'model', created: 1721245656, owned_by: 'system' },
            { id: 'claude-3-5-sonnet-20241022', object: 'model', created: 1729600000, owned_by: 'anthropic' },
            { id: 'gemini-1.5-pro-latest', object: 'model', created: 1715000000, owned_by: 'google' }
          ]
        }, null, 2),
      },
      {
        method: 'POST',
        path: '/v1/embeddings',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 80,
        enabled: true,
        response_body: JSON.stringify({
          object: 'list',
          data: [
            {
              object: 'embedding',
              index: 0,
              embedding: [0.0023, -0.0142, 0.0418, 0.0089, -0.0211, 0.0334, 0.0125, -0.0078]
            }
          ],
          model: 'text-embedding-3-small',
          usage: { prompt_tokens: 5, total_tokens: 5 }
        }, null, 2),
      }
    ]
  },
  {
    id: 'user-directory-rest',
    name: 'User Directory & Profile API',
    category: 'rest',
    description: 'User profiles, team member list, roles, and authorization token issuance.',
    icon: '👥',
    routes: [
      {
        method: 'GET',
        path: '/api/v1/users/me',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 0,
        enabled: true,
        response_body: JSON.stringify({
          id: 'usr_84920',
          username: 'alex.morgan',
          display_name: 'Alex Morgan',
          email: 'alex.morgan@company.internal',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          role: 'Lead Architect',
          team: 'Core Platform',
          is_active: true,
          created_at: '2024-01-15T08:30:00Z'
        }, null, 2),
      },
      {
        method: 'GET',
        path: '/api/v1/users',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 0,
        enabled: true,
        response_body: JSON.stringify({
          total: 3,
          users: [
            { id: 'usr_1', name: 'Elena Rostova', email: 'elena@example.com', role: 'Admin', department: 'Engineering' },
            { id: 'usr_2', name: 'Marcus Chen', email: 'marcus@example.com', role: 'Editor', department: 'Product' },
            { id: 'usr_3', name: 'Sarah Jenkins', email: 'sarah@example.com', role: 'Viewer', department: 'Design' }
          ]
        }, null, 2),
      },
      {
        method: 'POST',
        path: '/api/v1/auth/token',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 40,
        enabled: true,
        response_body: JSON.stringify({
          token_type: 'Bearer',
          access_token: 'kb_mock_jwt_' + Math.random().toString(36).slice(2) + '.' + Math.random().toString(36).slice(2),
          expires_in: 3600,
          scope: 'read write admin'
        }, null, 2),
      },
      {
        method: 'POST',
        path: '/api/v1/auth/refresh',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 30,
        enabled: true,
        response_body: JSON.stringify({
          token_type: 'Bearer',
          access_token: 'kb_refreshed_jwt_' + Math.random().toString(36).slice(2),
          expires_in: 3600
        }, null, 2),
      }
    ]
  },
  {
    id: 'payment-gateway-rest',
    name: 'Fintech & Payment Gateway API',
    category: 'rest',
    description: 'Stripe-compatible charges, refunds, customer balances, and invoice records.',
    icon: '💳',
    routes: [
      {
        method: 'POST',
        path: '/v1/charges',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 150,
        enabled: true,
        response_body: JSON.stringify({
          id: 'ch_' + Math.random().toString(36).slice(2, 12),
          object: 'charge',
          amount: 5000,
          amount_captured: 5000,
          currency: 'usd',
          paid: true,
          status: 'succeeded',
          payment_method: 'pm_card_visa',
          receipt_url: 'https://pay.example.com/receipts/kb_001'
        }, null, 2),
      },
      {
        method: 'GET',
        path: '/v1/customers',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 0,
        enabled: true,
        response_body: JSON.stringify({
          object: 'list',
          data: [
            { id: 'cus_991', name: 'Acme Corp', email: 'billing@acme.inc', balance: 0, currency: 'usd', deliquent: false },
            { id: 'cus_992', name: 'Globex Logistics', email: 'finance@globex.io', balance: 24500, currency: 'usd', deliquent: false }
          ]
        }, null, 2),
      },
      {
        method: 'POST',
        path: '/v1/refunds',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 100,
        enabled: true,
        response_body: JSON.stringify({
          id: 're_' + Math.random().toString(36).slice(2, 10),
          object: 'refund',
          amount: 5000,
          charge: 'ch_prev_charge_id',
          status: 'succeeded',
          reason: 'requested_by_customer'
        }, null, 2),
      }
    ]
  },
  {
    id: 'health-metrics-infra',
    name: 'DevOps Health & Observability',
    category: 'infra',
    description: 'Kubernetes healthz, ready probes, version metadata, and Prometheus service metrics.',
    icon: '🩺',
    routes: [
      {
        method: 'GET',
        path: '/healthz',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 0,
        enabled: true,
        response_body: JSON.stringify({ status: 'UP', timestamp: new Date().toISOString() }, null, 2),
      },
      {
        method: 'GET',
        path: '/ready',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 0,
        enabled: true,
        response_body: JSON.stringify({
          status: 'READY',
          checks: {
            database: { status: 'UP', latency_ms: 1.2 },
            redis_cache: { status: 'UP', latency_ms: 0.4 },
            message_broker: { status: 'UP', latency_ms: 2.1 }
          }
        }, null, 2),
      },
      {
        method: 'GET',
        path: '/version',
        status_code: 200,
        content_type: 'application/json',
        delay_ms: 0,
        enabled: true,
        response_body: JSON.stringify({
          version: '2.4.0',
          commit: 'a9f82d1e',
          build_date: '2026-08-18',
          environment: 'production',
          uptime_seconds: 849200
        }, null, 2),
      }
    ]
  },
  {
    id: 'grpc-greeter',
    name: 'gRPC Greeter Service',
    category: 'grpc',
    description: 'Classic Protobuf Hello World service featuring Unary and Server Streaming RPCs.',
    icon: '⚡',
    proto: SAMPLE_PROTO_DEFINITIONS[0].proto,
    routes: [
      {
        method: 'GRPC',
        path: '/helloworld.Greeter/SayHello',
        status_code: 200,
        content_type: 'application/grpc-web+proto',
        delay_ms: 0,
        enabled: true,
        response_body: JSON.stringify({
          message: 'Hello from mock gRPC Greeter!'
        }, null, 2),
      },
      {
        method: 'GRPC',
        path: '/helloworld.Greeter/SayHelloStream',
        status_code: 200,
        content_type: 'application/grpc-web+proto',
        delay_ms: 0,
        enabled: true,
        response_body: JSON.stringify({
          message: 'Streaming Hello packet #1 from mock server'
        }, null, 2),
      }
    ]
  },
  {
    id: 'grpc-catalog',
    name: 'gRPC Product Catalog Service',
    category: 'grpc',
    description: 'High-performance gRPC service for querying, listing, and inserting catalog products.',
    icon: '📦',
    proto: SAMPLE_PROTO_DEFINITIONS[2].proto,
    routes: [
      {
        method: 'GRPC',
        path: '/products.ProductService/GetProduct',
        status_code: 200,
        content_type: 'application/grpc-web+proto',
        delay_ms: 0,
        enabled: true,
        response_body: JSON.stringify({
          id: 'prod_g_901',
          name: 'High-Throughput gRPC Cluster Node',
          price: 1299.99,
          tags: ['hardware', 'server', 'grpc'],
          created_at: 1723651200
        }, null, 2),
      },
      {
        method: 'GRPC',
        path: '/products.ProductService/AddProduct',
        status_code: 200,
        content_type: 'application/grpc-web+proto',
        delay_ms: 50,
        enabled: true,
        response_body: JSON.stringify({
          id: 'prod_g_new_77',
          name: 'Enterprise Load Balancer',
          price: 499.00,
          tags: ['network', 'enterprise'],
          created_at: 1723651300
        }, null, 2),
      },
      {
        method: 'GRPC',
        path: '/products.ProductService/ListProducts',
        status_code: 200,
        content_type: 'application/grpc-web+proto',
        delay_ms: 0,
        enabled: true,
        response_body: JSON.stringify({
          id: 'prod_g_item',
          name: 'Database Cache Accelerator',
          price: 850.00,
          tags: ['cache', 'nvme'],
          created_at: 1723651400
        }, null, 2),
      }
    ]
  },
  {
    id: 'grpc-echo',
    name: 'gRPC Echo & Streaming Service',
    category: 'grpc',
    description: 'Unary, server streaming, client streaming, and bidirectional duplex echo RPCs.',
    icon: '🔁',
    proto: SAMPLE_PROTO_DEFINITIONS[1].proto,
    routes: [
      {
        method: 'GRPC',
        path: '/echo.EchoService/Echo',
        status_code: 200,
        content_type: 'application/grpc-web+proto',
        delay_ms: 0,
        enabled: true,
        response_body: JSON.stringify({
          message: 'Echo response payload from mock server',
          sequence_number: 1
        }, null, 2),
      },
      {
        method: 'GRPC',
        path: '/echo.EchoService/ServerStreamingEcho',
        status_code: 200,
        content_type: 'application/grpc-web+proto',
        delay_ms: 0,
        enabled: true,
        response_body: JSON.stringify({
          message: 'Server streaming message #1',
          sequence_number: 100
        }, null, 2),
      }
    ]
  }
];

export function createRoutesFromTemplate(template: MockServerTemplate): MockRoute[] {
  return template.routes.map((r, i) => ({
    ...r,
    id: `route-tpl-${template.id}-${Date.now()}-${i}`
  }));
}
