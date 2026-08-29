<?php

use App\Http\Controllers\Api\V1\ActivityLogController;
use App\Http\Controllers\Api\V1\ApprovalController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BillingController;
use App\Http\Controllers\Api\V1\CalendarController;
use App\Http\Controllers\Api\V1\CatalogController;
use App\Http\Controllers\Api\V1\ChatController;
use App\Http\Controllers\Api\V1\CategoryController;
use App\Http\Controllers\Api\V1\ChoiceController;
use App\Http\Controllers\Api\V1\ChoiceTypeController;
use App\Http\Controllers\Api\V1\CompanyInviteController;
use App\Http\Controllers\Api\V1\CompanyController;
use App\Http\Controllers\Api\V1\ContactController;
use App\Http\Controllers\Api\V1\CustomFieldDefinitionController;
use App\Http\Controllers\Api\V1\CustomerController;
use App\Http\Controllers\Api\V1\DepartmentController;
use App\Http\Controllers\Api\V1\DiscountController;
use App\Http\Controllers\Api\V1\DiningLayoutController;
use App\Http\Controllers\Api\V1\DiningTableController;
use App\Http\Controllers\Api\V1\ItemTypeController;
use App\Http\Controllers\Api\V1\JobLevelController;
use App\Http\Controllers\Api\V1\MarketingBlogController;
use App\Http\Controllers\Api\V1\MeController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\OutletController;
use App\Http\Controllers\Api\V1\PlatformBlogController;
use App\Http\Controllers\Api\V1\PlatformSupportController;
use App\Http\Controllers\Api\V1\PlatformController;
use App\Http\Controllers\Api\V1\PriceChannelController;
use App\Http\Controllers\Api\V1\ProductController;
use App\Http\Controllers\Api\V1\PlatformRoleController;
use App\Http\Controllers\Api\V1\PositionController;
use App\Http\Controllers\Api\V1\PromotionController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\SaleController;
use App\Http\Controllers\Api\V1\GoodsReceiptController;
use App\Http\Controllers\Api\V1\PublicCompanyInviteController;
use App\Http\Controllers\Api\V1\PublicPurchaseOrderController;
use App\Http\Controllers\Api\V1\PublicPurchaseRequisitionController;
use App\Http\Controllers\Api\V1\PurchaseOrderController;
use App\Http\Controllers\Api\V1\PurchaseRequisitionController;
use App\Http\Controllers\Api\V1\StockController;
use App\Http\Controllers\Api\V1\SubCategoryController;
use App\Http\Controllers\Api\V1\SupplierController;
use App\Http\Controllers\Api\V1\UnitController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\WarehouseController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    Route::post('auth/register', [AuthController::class, 'register'])
        ->middleware('throttle:register')
        ->withoutMiddleware('throttle:api');
    Route::post('auth/login', [AuthController::class, 'login'])
        ->middleware('throttle:login')
        ->withoutMiddleware('throttle:api');
    Route::post('auth/accept-invite', [AuthController::class, 'acceptInvite'])
        ->middleware('throttle:register')
        ->withoutMiddleware('throttle:api');
    Route::get('catalog', [CatalogController::class, 'show']);
    Route::get('marketing/blog', [MarketingBlogController::class, 'index']);
    Route::get('marketing/blog/{slug}', [MarketingBlogController::class, 'show']);
    Route::get('public/purchase-orders/{shareToken}', [PublicPurchaseOrderController::class, 'show']);
    Route::get('public/purchase-requisitions/{shareToken}', [PublicPurchaseRequisitionController::class, 'show']);
    Route::get('public/invites/{token}', [PublicCompanyInviteController::class, 'show']);

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::post('auth/logout-all', [AuthController::class, 'logoutAll']);
        Route::post('activity-logs/events', [ActivityLogController::class, 'storeEvent']);

        Route::get('me', [MeController::class, 'show']);
        Route::put('me', [MeController::class, 'update']);
        Route::put('me/password', [MeController::class, 'updatePassword']);
        Route::put('me/preferences', [MeController::class, 'updatePreferences']);
        Route::post('me/wallpaper', [MeController::class, 'storeWallpaper']);
        Route::post('me/avatar', [MeController::class, 'storeAvatar']);
        Route::get('calendar', [CalendarController::class, 'show']);
        Route::post('reminders', [CalendarController::class, 'storeReminder']);
        Route::delete('reminders/{reminder}', [CalendarController::class, 'destroyReminder']);
        Route::get('me/companies', [MeController::class, 'companies']);
        Route::put('me/company', [MeController::class, 'switchCompany']);
        Route::post('me/companies', [MeController::class, 'storeCompany']);

        Route::middleware('platform')->group(function () {
            Route::get('platform/overview', [PlatformController::class, 'overview']);

            Route::get('platform/companies', [PlatformController::class, 'companies']);
            Route::put('platform/companies/{company}', [PlatformController::class, 'updateCompany']);
            Route::post('platform/companies/{company}/invoices', [PlatformController::class, 'issueInvoice']);

            Route::get('platform/plans', [PlatformController::class, 'plans']);
            Route::post('platform/plans', [PlatformController::class, 'storePlan']);
            Route::put('platform/plans/{plan}', [PlatformController::class, 'updatePlan']);

            Route::get('platform/business-types', [PlatformController::class, 'businessTypes']);
            Route::post('platform/business-types', [PlatformController::class, 'storeBusinessType']);
            Route::put('platform/business-types/{businessType}', [PlatformController::class, 'updateBusinessType']);

            Route::get('platform/blog-posts', [PlatformBlogController::class, 'index']);
            Route::post('platform/blog-posts', [PlatformBlogController::class, 'store']);
            Route::get('platform/blog-posts/{blogPost}', [PlatformBlogController::class, 'show']);
            Route::put('platform/blog-posts/{blogPost}', [PlatformBlogController::class, 'update']);
            Route::delete('platform/blog-posts/{blogPost}', [PlatformBlogController::class, 'destroy']);
            Route::post('platform/blog-posts/{blogPost}/cover', [PlatformBlogController::class, 'storeCover']);
            Route::post('platform/blog-posts/{blogPost}/media', [PlatformBlogController::class, 'storeMedia']);

            Route::get('platform/invoices', [PlatformController::class, 'invoices']);
            Route::post('platform/invoices/{invoice}/pay', [PlatformController::class, 'payInvoice']);
            Route::post('platform/invoices/{invoice}/void', [PlatformController::class, 'voidInvoice']);

            Route::get('platform/roles', [PlatformRoleController::class, 'index']);
            Route::post('platform/roles', [PlatformRoleController::class, 'store']);
            Route::put('platform/roles/{role}', [PlatformRoleController::class, 'update']);
            Route::delete('platform/roles/{role}', [PlatformRoleController::class, 'destroy']);
            Route::get('platform/users', [PlatformController::class, 'users']);
            Route::post('platform/users', [PlatformController::class, 'storeUser']);
            Route::put('platform/users/{user}', [PlatformController::class, 'updateUser']);
            Route::delete('platform/users/{user}', [PlatformController::class, 'destroyUser']);
            Route::get('platform/activity-logs', [ActivityLogController::class, 'platformIndex']);

            Route::get('platform/support/conversations', [PlatformSupportController::class, 'conversations']);
            Route::post('platform/support/conversations/{conversation}/join', [PlatformSupportController::class, 'join']);
            Route::get('platform/support/conversations/{conversation}/messages', [PlatformSupportController::class, 'messages']);
            Route::post('platform/support/conversations/{conversation}/messages', [PlatformSupportController::class, 'storeMessage']);
            Route::post('platform/support/conversations/{conversation}/read', [PlatformSupportController::class, 'markRead']);
        });

        Route::middleware('company')->group(function () {
            Route::get('company', [CompanyController::class, 'show']);
            Route::put('company', [CompanyController::class, 'update']);
            Route::post('company/logo', [CompanyController::class, 'storeLogo']);
            Route::delete('company/logo', [CompanyController::class, 'destroyLogo']);
            Route::get('company/settings', [CompanyController::class, 'settings']);
            Route::put('company/settings', [CompanyController::class, 'updateSettings']);
            Route::get('billing', [BillingController::class, 'show']);
            Route::post('billing/subscribe', [BillingController::class, 'subscribe']);

            Route::get('roles', [RoleController::class, 'index']);
            Route::post('roles', [RoleController::class, 'store']);
            Route::put('roles/{role}', [RoleController::class, 'update']);
            Route::delete('roles/{role}', [RoleController::class, 'destroy']);
            Route::get('users', [UserController::class, 'index']);
            Route::post('users', [UserController::class, 'store']);
            Route::put('users/{user}', [UserController::class, 'update']);
            Route::post('users/{user}/documents/{type}', [UserController::class, 'storeDocument']);
            Route::get('users/{user}/documents/{type}', [UserController::class, 'showDocument']);
            Route::post('users/{user}/approve-onboarding', [UserController::class, 'approveOnboarding']);
            Route::post('users/{user}/reject-onboarding', [UserController::class, 'rejectOnboarding']);
            Route::delete('users/{user}', [UserController::class, 'destroy']);

            Route::get('company-invites', [CompanyInviteController::class, 'index']);
            Route::post('company-invites', [CompanyInviteController::class, 'store']);
            Route::delete('company-invites/{invite}', [CompanyInviteController::class, 'destroy']);

            Route::get('departments', [DepartmentController::class, 'index']);
            Route::post('departments', [DepartmentController::class, 'store']);
            Route::put('departments/{department}', [DepartmentController::class, 'update']);
            Route::delete('departments/{department}', [DepartmentController::class, 'destroy']);

            Route::get('positions', [PositionController::class, 'index']);
            Route::post('positions', [PositionController::class, 'store']);
            Route::put('positions/{position}', [PositionController::class, 'update']);
            Route::delete('positions/{position}', [PositionController::class, 'destroy']);

            Route::get('job-levels', [JobLevelController::class, 'index']);
            Route::post('job-levels', [JobLevelController::class, 'store']);
            Route::put('job-levels/{jobLevel}', [JobLevelController::class, 'update']);
            Route::delete('job-levels/{jobLevel}', [JobLevelController::class, 'destroy']);

            Route::get('chat/peers', [ChatController::class, 'peers']);
            Route::post('chat/presence', [ChatController::class, 'presence']);
            Route::get('chat/conversations', [ChatController::class, 'conversations']);
            Route::post('chat/conversations', [ChatController::class, 'storeConversation']);
            Route::post('chat/support', [ChatController::class, 'openSupport']);
            Route::get('chat/conversations/{conversation}/messages', [ChatController::class, 'messages']);
            Route::post('chat/conversations/{conversation}/messages', [ChatController::class, 'storeMessage']);
            Route::post('chat/conversations/{conversation}/read', [ChatController::class, 'markRead']);

            Route::get('outlets', [OutletController::class, 'index']);
            Route::post('outlets', [OutletController::class, 'store']);
            Route::put('outlets/{outlet}', [OutletController::class, 'update']);
            Route::delete('outlets/{outlet}', [OutletController::class, 'destroy']);

            Route::get('categories', [CategoryController::class, 'index']);
            Route::post('categories', [CategoryController::class, 'store']);
            Route::put('categories/{category}', [CategoryController::class, 'update']);
            Route::delete('categories/{category}', [CategoryController::class, 'destroy']);

            Route::get('subcategories', [SubCategoryController::class, 'index']);
            Route::post('subcategories', [SubCategoryController::class, 'store']);
            Route::put('subcategories/{sub_category}', [SubCategoryController::class, 'update']);
            Route::delete('subcategories/{sub_category}', [SubCategoryController::class, 'destroy']);

            Route::get('units', [UnitController::class, 'index']);
            Route::post('units', [UnitController::class, 'store']);
            Route::put('units/{unit}', [UnitController::class, 'update']);
            Route::delete('units/{unit}', [UnitController::class, 'destroy']);

            Route::get('item-types', [ItemTypeController::class, 'index']);
            Route::post('item-types', [ItemTypeController::class, 'store']);
            Route::put('item-types/{item_type}', [ItemTypeController::class, 'update']);
            Route::delete('item-types/{item_type}', [ItemTypeController::class, 'destroy']);

            Route::get('price-channels', [PriceChannelController::class, 'index']);
            Route::post('price-channels', [PriceChannelController::class, 'store']);
            Route::put('price-channels/{price_channel}', [PriceChannelController::class, 'update']);
            Route::delete('price-channels/{price_channel}', [PriceChannelController::class, 'destroy']);
            Route::get('discounts', [DiscountController::class, 'index']);
            Route::post('discounts', [DiscountController::class, 'store']);
            Route::put('discounts/{discount}', [DiscountController::class, 'update']);
            Route::delete('discounts/{discount}', [DiscountController::class, 'destroy']);
            Route::get('custom-fields', [CustomFieldDefinitionController::class, 'index']);
            Route::post('custom-fields', [CustomFieldDefinitionController::class, 'store']);
            Route::put('custom-fields/{custom_field_definition}', [CustomFieldDefinitionController::class, 'update']);
            Route::delete('custom-fields/{custom_field_definition}', [CustomFieldDefinitionController::class, 'destroy']);
            Route::get('promotions', [PromotionController::class, 'index']);
            Route::post('promotions/preview', [PromotionController::class, 'preview']);
            Route::post('promotions', [PromotionController::class, 'store']);
            Route::put('promotions/{promotion}', [PromotionController::class, 'update']);
            Route::delete('promotions/{promotion}', [PromotionController::class, 'destroy']);

            Route::get('dining-layouts', [DiningLayoutController::class, 'index']);
            Route::post('dining-layouts', [DiningLayoutController::class, 'store']);
            Route::get('dining-layouts/{dining_layout}', [DiningLayoutController::class, 'show']);
            Route::put('dining-layouts/{dining_layout}', [DiningLayoutController::class, 'update']);
            Route::delete('dining-layouts/{dining_layout}', [DiningLayoutController::class, 'destroy']);

            Route::get('dining-tables', [DiningTableController::class, 'index']);
            Route::post('dining-tables', [DiningTableController::class, 'store']);
            Route::put('dining-tables/{dining_table}', [DiningTableController::class, 'update']);
            Route::delete('dining-tables/{dining_table}', [DiningTableController::class, 'destroy']);

            Route::get('choice-types', [ChoiceTypeController::class, 'index']);
            Route::post('choice-types', [ChoiceTypeController::class, 'store']);
            Route::put('choice-types/{choice_type}', [ChoiceTypeController::class, 'update']);
            Route::delete('choice-types/{choice_type}', [ChoiceTypeController::class, 'destroy']);

            Route::get('choices', [ChoiceController::class, 'index']);
            Route::post('choices', [ChoiceController::class, 'store']);
            Route::put('choices/{choice}', [ChoiceController::class, 'update']);
            Route::delete('choices/{choice}', [ChoiceController::class, 'destroy']);

            Route::get('warehouses', [WarehouseController::class, 'index']);
            Route::post('warehouses', [WarehouseController::class, 'store']);
            Route::put('warehouses/{warehouse}', [WarehouseController::class, 'update']);
            Route::delete('warehouses/{warehouse}', [WarehouseController::class, 'destroy']);

            Route::get('products', [ProductController::class, 'index']);
            Route::post('products', [ProductController::class, 'store']);
            Route::get('products/barcode/{code}', [ProductController::class, 'barcode']);
            Route::post('products/{product}/images', [ProductController::class, 'storeImages']);
            Route::post('products/{product}/images/{product_image}/primary', [ProductController::class, 'setPrimary']);
            Route::delete('products/{product}/images/{product_image}', [ProductController::class, 'destroyImage']);
            Route::get('products/{product}', [ProductController::class, 'show']);
            Route::put('products/{product}', [ProductController::class, 'update']);
            Route::delete('products/{product}', [ProductController::class, 'destroy']);

            Route::get('contacts', [ContactController::class, 'index']);
            Route::post('contacts', [ContactController::class, 'store']);
            Route::get('contacts/{contact}', [ContactController::class, 'show']);
            Route::put('contacts/{contact}', [ContactController::class, 'update']);

            Route::get('customers', [CustomerController::class, 'index']);
            Route::post('customers', [CustomerController::class, 'store']);
            Route::put('customers/{contact}', [CustomerController::class, 'update']);
            Route::delete('customers/{contact}', [CustomerController::class, 'destroy']);

            Route::get('suppliers', [SupplierController::class, 'index']);
            Route::get('suppliers/top', [SupplierController::class, 'top']);
            Route::post('suppliers', [SupplierController::class, 'store']);
            Route::put('suppliers/{contact}', [SupplierController::class, 'update']);
            Route::delete('suppliers/{contact}', [SupplierController::class, 'destroy']);

            Route::get('sales', [SaleController::class, 'index']);
            Route::post('sales', [SaleController::class, 'store']);
            Route::get('sales/settlement', [SaleController::class, 'settlement']);
            Route::get('sales/reports', [SaleController::class, 'reports']);
            Route::post('sales/reports/async', [SaleController::class, 'reportsAsync']);
            Route::get('sales/reports/async/{jobId}', [SaleController::class, 'reportsAsyncStatus']);
            Route::get('sales/{sale}', [SaleController::class, 'show']);
            Route::get('sales/{sale}/receipt', [SaleController::class, 'receipt']);
            Route::post('sales/{sale}/payments', [SaleController::class, 'addPayment']);
            Route::post('sales/{sale}/cancel', [SaleController::class, 'cancel']);

            Route::get('stock', [StockController::class, 'index']);
            Route::get('stock/low', [StockController::class, 'low']);
            Route::get('stock/movements', [StockController::class, 'movements']);

            Route::get('notifications', [NotificationController::class, 'index']);
            Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);
            Route::post('notifications/read-all', [NotificationController::class, 'markAllRead']);
            Route::post('notifications/{notification}/read', [NotificationController::class, 'markRead']);

            Route::middleware('sse.auth')->group(function () {
                Route::get('notifications/stream', [NotificationController::class, 'stream'])
                    ->withoutMiddleware('throttle:api');
                Route::get('chat/conversations/{conversation}/stream', [ChatController::class, 'messageStream'])
                    ->withoutMiddleware('throttle:api');
            });

            Route::get('approvals/pending', [ApprovalController::class, 'index']);

            Route::get('purchase-requisitions', [PurchaseRequisitionController::class, 'index']);
            Route::post('purchase-requisitions', [PurchaseRequisitionController::class, 'store']);
            Route::get('purchase-requisitions/{purchaseRequisition}', [PurchaseRequisitionController::class, 'show']);
            Route::put('purchase-requisitions/{purchaseRequisition}', [PurchaseRequisitionController::class, 'update']);
            Route::post('purchase-requisitions/{purchaseRequisition}/submit', [PurchaseRequisitionController::class, 'submit']);
            Route::post('purchase-requisitions/{purchaseRequisition}/approve', [PurchaseRequisitionController::class, 'approve']);
            Route::post('purchase-requisitions/{purchaseRequisition}/reject', [PurchaseRequisitionController::class, 'reject']);
            Route::post('purchase-requisitions/{purchaseRequisition}/cancel', [PurchaseRequisitionController::class, 'cancel']);
            Route::post('purchase-requisitions/{purchaseRequisition}/share', [PurchaseRequisitionController::class, 'share']);

            Route::get('purchase-orders', [PurchaseOrderController::class, 'index']);
            Route::post('purchase-orders', [PurchaseOrderController::class, 'store']);
            Route::get('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show']);
            Route::put('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'update']);
            Route::post('purchase-orders/{purchaseOrder}/order', [PurchaseOrderController::class, 'markOrdered']);
            Route::post('purchase-orders/{purchaseOrder}/submit', [PurchaseOrderController::class, 'submit']);
            Route::post('purchase-orders/{purchaseOrder}/approve', [PurchaseOrderController::class, 'approve']);
            Route::post('purchase-orders/{purchaseOrder}/reject', [PurchaseOrderController::class, 'reject']);
            Route::post('purchase-orders/{purchaseOrder}/cancel', [PurchaseOrderController::class, 'cancel']);
            Route::post('purchase-orders/{purchaseOrder}/share', [PurchaseOrderController::class, 'share']);

            Route::get('goods-receipts', [GoodsReceiptController::class, 'index']);
            Route::post('goods-receipts', [GoodsReceiptController::class, 'store']);
            Route::get('goods-receipts/{goodsReceipt}', [GoodsReceiptController::class, 'show']);
            Route::put('goods-receipts/{goodsReceipt}', [GoodsReceiptController::class, 'update']);
            Route::post('goods-receipts/{goodsReceipt}/confirm', [GoodsReceiptController::class, 'confirm']);
            Route::post('goods-receipts/{goodsReceipt}/cancel', [GoodsReceiptController::class, 'cancel']);

            Route::get('reports/today', [ReportController::class, 'today']);
            Route::get('reports/summary', [ReportController::class, 'summary']);
            Route::get('activity-logs', [ActivityLogController::class, 'index']);
        });
    });
});
