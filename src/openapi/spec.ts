export const spec = {
  openapi: '3.1.0',
  info: {
    title: 'Role API',
    version: '1.0.0',
    description: `Backend API para **Role** — marketplace de comida excedente estilo Too Good To Go.

Los clientes se autentican con tokens de acceso de Supabase Auth (Bearer JWT).`,
    contact: { name: 'Role Team' },
  },
  servers: [
    { url: `http://localhost:${process.env.PORT || 4001}/api/v1`, description: 'Local development' },
    { url: 'https://api.role.com.co/api/v1', description: 'Production' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        operationId: 'healthCheck',
        responses: {
          '200': {
            description: 'Service health',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['ok', 'degraded'] },
                    database: { type: 'string', enum: ['up', 'down'] },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Iniciar sesión con email y contraseña',
        operationId: 'authLogin',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          '200': {
            description: 'Autenticación exitosa',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
          },
          '401': { description: 'Credenciales inválidas' },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Registrar nueva cuenta de administrador',
        operationId: 'authRegister',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } },
        },
        responses: {
          '201': {
            description: 'Usuario registrado exitosamente',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
          },
          '400': { description: 'Datos inválidos' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Renovar tokens de acceso con un refresh token',
        description: 'Intercambia un refresh token válido de Supabase por un nuevo par de tokens.',
        operationId: 'authRefresh',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } } },
        },
        responses: {
          '200': {
            description: 'Tokens renovados',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } },
          },
          '400': { description: 'Cuerpo de la solicitud inválido' },
          '401': { description: 'Refresh token inválido o expirado' },
        },
      },
    }, '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Obtener perfil del usuario autenticado',
        operationId: 'authMe',
        security: [{ bearer: [] }],
        responses: {
          '200': {
            description: 'Perfil del usuario',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthUserResponse' } } },
          },
          '401': { description: 'No autorizado' },
        },
      },
    },
    '/offers': {
      get: {
        tags: ['Offers'],
        summary: 'Listar ofertas de comida excedente disponibles',
        operationId: 'listOffers',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filtrar por categoría' },
          { name: 'business_id', in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Filtrar por negocio' },
          { name: 'lat', in: 'query', schema: { type: 'number', minimum: -90, maximum: 90 }, description: 'Latitud para búsqueda geográfica' },
          { name: 'lng', in: 'query', schema: { type: 'number', minimum: -180, maximum: 180 }, description: 'Longitud para búsqueda geográfica' },
          { name: 'radius_km', in: 'query', schema: { type: 'number', maximum: 100, default: 10 }, description: 'Radio de búsqueda en km' },
          { name: 'available_only', in: 'query', schema: { type: 'boolean', default: true }, description: 'Solo ofertas disponibles' },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          '200': {
            description: 'Lista paginada de ofertas',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedOfferResponse' } } },
          },
        },
      },
    },
    '/offers/{id}': {
      get: {
        tags: ['Offers'],
        summary: 'Obtener detalle de una oferta',
        operationId: 'getOfferById',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Detalle de la oferta con negocio y ubicación',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/OfferWithBusiness' } } },
          },
          '404': { description: 'Oferta no encontrada' },
        },
      },
    },
    '/categories': {
      get: {
        tags: ['Categories'],
        summary: 'Listar categorías',
        operationId: 'listCategories',
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string', minLength: 1, maxLength: 100 }, description: 'Buscar por nombre' },
          { name: 'active', in: 'query', schema: { type: 'boolean' }, description: 'Filtrar por estado activo' },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          '200': {
            description: 'Lista paginada de categorías',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedCategoryResponse' } } },
          },
        },
      },
      post: {
        tags: ['Categories'],
        summary: 'Crear una categoría (admin)',
        operationId: 'createCategory',
        security: [{ bearer: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateCategoryRequest' } } },
        },
        responses: {
          '201': {
            description: 'Categoría creada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } },
          },
          '401': { description: 'No autorizado' },
          '403': { description: 'Requiere rol admin' },
          '409': { description: 'Nombre o slug ya existe' },
        },
      },
    },
    '/categories/{id}': {
      get: {
        tags: ['Categories'],
        summary: 'Obtener categoría por ID',
        operationId: 'getCategoryById',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Detalle de la categoría',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } },
          },
          '404': { description: 'Categoría no encontrada' },
        },
      },
      patch: {
        tags: ['Categories'],
        summary: 'Actualizar una categoría (admin)',
        operationId: 'updateCategory',
        security: [{ bearer: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateCategoryRequest' } } },
        },
        responses: {
          '200': {
            description: 'Categoría actualizada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } },
          },
          '401': { description: 'No autorizado' },
          '403': { description: 'Requiere rol admin' },
          '404': { description: 'Categoría no encontrada' },
          '409': { description: 'Nombre o slug ya existe' },
        },
      },
      delete: {
        tags: ['Categories'],
        summary: 'Eliminar (soft-delete) una categoría (admin)',
        operationId: 'deleteCategory',
        security: [{ bearer: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Categoría eliminada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Category' } } },
          },
          '401': { description: 'No autorizado' },
          '403': { description: 'Requiere rol admin' },
          '404': { description: 'Categoría no encontrada' },
        },
      },
    },
    '/orders': {
      post: {
        tags: ['Orders'],
        summary: 'Reservar / crear una orden para una oferta',
        operationId: 'createOrder',
        security: [{ bearer: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrderRequest' } } },
        },
        responses: {
          '201': {
            description: 'Orden creada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } },
          },
        },
      },
      get: {
        tags: ['Orders'],
        summary: 'Listar mis órdenes',
        operationId: 'listMyOrders',
        security: [{ bearer: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/OrderStatus' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: {
          '200': {
            description: 'Lista paginada de órdenes',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedOrderResponse' } } },
          },
        },
      },
    },
    '/orders/{id}': {
      get: {
        tags: ['Orders'],
        summary: 'Obtener orden por ID',
        operationId: 'getOrderById',
        security: [{ bearer: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'Detalle de la orden',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } },
          },
        },
      },
    },
    '/orders/{id}/status': {
      patch: {
        tags: ['Orders'],
        summary: 'Actualizar estado de una orden',
        operationId: 'updateOrderStatus',
        security: [{ bearer: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UpdateOrderStatusRequest' } } },
        },
        responses: {
          '200': {
            description: 'Orden actualizada',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Order' } } },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase Auth access_token',
      },
    },
    schemas: {
      // ─── Enums ─────────────────────────────────────────────────────
      OrderStatus: {
        type: 'string',
        enum: ['pending', 'confirmed', 'ready_for_pickup', 'picked_up', 'completed', 'cancelled', 'expired'],
      },
      AppRole: {
        type: 'string',
        enum: ['user', 'business', 'admin'],
      },

      // ─── Common ────────────────────────────────────────────────────
      PaginationMeta: {
        type: 'object',
        description: 'Metadatos de paginación devueltos por los endpoints de lista.',
        properties: {
          page: { type: 'integer', minimum: 1, example: 1 },
          limit: { type: 'integer', minimum: 1, example: 20 },
          total: { type: 'integer', minimum: 0, example: 42 },
          total_pages: { type: 'integer', minimum: 0, example: 3 },
        },
        required: ['page', 'limit', 'total', 'total_pages'],
      },
      ApiError: {
        type: 'object',
        description: 'Formato de error uniforme entregado por el filtro global de excepciones.',
        properties: {
          statusCode: { type: 'integer', example: 400 },
          message: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], example: 'Validation failed' },
          error: { type: 'string', example: 'Bad Request' },
          path: { type: 'string', example: '/api/v1/orders' },
          timestamp: { type: 'string', format: 'date-time' },
          details: { type: 'array', items: { type: 'object', additionalProperties: true } },
        },
        required: ['statusCode', 'message', 'error', 'path', 'timestamp'],
      },

      // ─── Auth ──────────────────────────────────────────────────────
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', minLength: 6, example: '••••••••' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['email', 'password', 'full_name'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', minLength: 8, example: '••••••••' },
          full_name: { type: 'string', minLength: 2, maxLength: 100, example: 'Juan Pérez' },
        },
      },
      RefreshRequest: {
        type: 'object',
        required: ['refresh_token'],
        properties: {
          refresh_token: { type: 'string', minLength: 1, description: 'Refresh token emitido por Supabase Auth' },
        },
      }, AuthUser: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          full_name: { type: 'string', nullable: true },
          avatar_url: { type: 'string', nullable: true },
          role: { $ref: '#/components/schemas/AppRole' },
        },
        required: ['id', 'email', 'full_name', 'avatar_url', 'role'],
      },
      AuthResponse: {
        type: 'object',
        properties: {
          access_token: { type: 'string' },
          refresh_token: { type: 'string' },
          expires_in: { type: 'integer' },
          expires_at: { type: 'string', format: 'date-time', nullable: true },
          user: { $ref: '#/components/schemas/AuthUser' },
        },
        required: ['access_token', 'refresh_token', 'expires_in', 'expires_at', 'user'],
      },
      AuthUserResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/AuthUser' },
        },
        required: ['user'],
      },

      // ─── Offer ─────────────────────────────────────────────────────
      Offer: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          business_id: { type: 'string', format: 'uuid' },
          business_location_id: { type: 'string', format: 'uuid' },
          title: { type: 'string', minLength: 1 },
          description: { type: 'string', nullable: true },
          image: { type: 'string', nullable: true },
          category: { type: 'string', nullable: true },
          original_price: { type: 'number', exclusiveMinimum: 0 },
          discounted_price: { type: 'number', exclusiveMinimum: 0 },
          discount_percentage: { type: 'number', nullable: true },
          stock: { type: 'integer', minimum: 0 },
          initial_stock: { type: 'integer', minimum: 0 },
          pickup_start: { type: 'string', format: 'date-time' },
          pickup_end: { type: 'string', format: 'date-time' },
          is_active: { type: 'boolean' },
          includes: { type: 'string', nullable: true },
          allergens: { type: 'string', nullable: true },
          rating: { type: 'number' },
          review_count: { type: 'integer' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'business_id', 'business_location_id', 'title', 'original_price', 'discounted_price', 'stock', 'initial_stock', 'pickup_start', 'pickup_end', 'is_active', 'rating', 'review_count', 'created_at', 'updated_at'],
      },
      SlimBusiness: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          slug: { type: 'string' },
          image: { type: 'string', nullable: true },
          rating: { type: 'number', nullable: true },
        },
        required: ['id', 'name', 'slug'],
      },
      SlimLocation: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          address: { type: 'string' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          zone: { type: 'string', nullable: true },
        },
        required: ['id', 'name', 'address', 'latitude', 'longitude'],
      },
      OfferWithBusiness: {
        type: 'object',
        allOf: [
          { $ref: '#/components/schemas/Offer' },
          {
            type: 'object',
            properties: {
              business: { $ref: '#/components/schemas/SlimBusiness' },
              location: { $ref: '#/components/schemas/SlimLocation' },
            },
            required: ['business', 'location'],
          },
        ],
      },

      // ─── Category ──────────────────────────────────────────────────
      Category: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', minLength: 3 },
          description: { type: 'string', nullable: true },
          emoji: { type: 'string', nullable: true },
          slug: { type: 'string', minLength: 1 },
          image_url: { type: 'string', nullable: true },
          active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
          deleted_at: { type: 'string', format: 'date-time', nullable: true },
        },
        required: ['id', 'name', 'description', 'emoji', 'slug', 'image_url', 'active', 'created_at', 'updated_at', 'deleted_at'],
      },
      CreateCategoryRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 3, maxLength: 100, example: 'Panadería' },
          description: { type: 'string', maxLength: 500, nullable: true, example: 'Productos de panadería y pastelería' },
          emoji: { type: 'string', maxLength: 16, nullable: true, example: '🥐' },
          slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', example: 'panaderia' },
          image_url: { type: 'string', nullable: true },
          active: { type: 'boolean', default: true },
        },
      },
      UpdateCategoryRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 3, maxLength: 100 },
          description: { type: 'string', maxLength: 500, nullable: true },
          emoji: { type: 'string', maxLength: 16, nullable: true },
          slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
          image_url: { type: 'string', nullable: true },
          active: { type: 'boolean' },
        },
      },

      // ─── Order ─────────────────────────────────────────────────────
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          offer_id: { type: 'string', format: 'uuid' },
          business_id: { type: 'string', format: 'uuid' },
          order_number: { type: 'string', minLength: 1 },
          status: { $ref: '#/components/schemas/OrderStatus' },
          price: { type: 'number', exclusiveMinimum: 0 },
          original_price: { type: 'number', exclusiveMinimum: 0 },
          pickup_code: { type: 'string', minLength: 1 },
          pickup_time: { type: 'string', format: 'date-time', nullable: true },
          coupon_id: { type: 'string', format: 'uuid', nullable: true },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
        required: ['id', 'user_id', 'offer_id', 'business_id', 'order_number', 'status', 'price', 'original_price', 'pickup_code', 'created_at', 'updated_at'],
      },
      CreateOrderRequest: {
        type: 'object',
        required: ['offer_id'],
        properties: {
          offer_id: { type: 'string', format: 'uuid' },
          coupon_code: { type: 'string', minLength: 1 },
        },
      },
      UpdateOrderStatusRequest: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { $ref: '#/components/schemas/OrderStatus' },
          reason: { type: 'string', maxLength: 500 },
        },
      },

      // ─── Response Wrappers ─────────────────────────────────────────
      PaginatedOfferResponse: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/OfferWithBusiness' } },
          meta: { $ref: '#/components/schemas/PaginationMeta' },
        },
        required: ['data', 'meta'],
      },
      PaginatedOrderResponse: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/Order' } },
          meta: { $ref: '#/components/schemas/PaginationMeta' },
        },
        required: ['data', 'meta'],
      },
      PaginatedCategoryResponse: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/Category' } },
          meta: { $ref: '#/components/schemas/PaginationMeta' },
        },
        required: ['data', 'meta'],
      },
    },
  },
  tags: [
    { name: 'Health', description: 'Verificación del estado del servidor' },
    { name: 'Auth', description: 'Autenticación y registro de usuarios' },
    { name: 'Categories', description: 'Catálogo de categorías de comida' },
    { name: 'Offers', description: 'Ofertas de comida excedente disponibles' },
    { name: 'Orders', description: 'Gestión de órdenes y reservas' },
  ],
};
