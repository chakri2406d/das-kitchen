/**
 * Das Kitchen — database types.
 *
 * These mirror `das_kitchen_schema.sql`. Once your Supabase project is live you
 * can regenerate the fully-accurate version with:
 *   npx supabase gen types typescript --project-id YOUR_ID > src/types/database.ts
 */

export type UserRole = "customer" | "admin" | "delivery_partner";
export type OrderStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready_for_pickup"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";
export type PaymentMethod = "cod" | "razorpay" | "upi";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type FoodType = "veg" | "non_veg" | "egg";
export type BusinessStatus = "open" | "closed" | "busy";
export type CouponType = "percentage" | "flat";
export type VehicleType = "bike" | "scooter" | "bicycle" | "car";
export type RiderStatus = "available" | "busy" | "offline";
export type NotificationType =
  | "order_confirmed"
  | "order_accepted"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "general";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export type DeliveryPartner = {
  id: string;
  vehicle_type: VehicleType;
  vehicle_number: string | null;
  status: RiderStatus;
  current_lat: number | null;
  current_lng: number | null;
  is_verified: boolean;
  total_deliveries: number;
  rating: number;
  created_at: string;
  updated_at: string;
}

export type Address = {
  id: string;
  user_id: string;
  label: string | null;
  house_number: string | null;
  street: string | null;
  landmark: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
  created_at: string;
}

export type Category = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

export type MenuItem = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  food_type: FoodType;
  is_available: boolean;
  is_special: boolean;
  daily_quantity_limit: number | null;
  prep_time_minutes: number;
  order_count: number;
  created_at: string;
  updated_at: string;
}

export type CartItem = {
  id: string;
  user_id: string;
  menu_item_id: string;
  quantity: number;
  created_at: string;
}

export type Coupon = {
  id: string;
  code: string;
  once_per_customer: boolean;
  coupon_type: CouponType;
  discount_value: number;
  min_order_amount: number | null;
  max_discount: number | null;
  expiry_date: string | null;
  usage_limit: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
}

export type Order = {
  id: string;
  order_number: string | null;
  customer_id: string;
  delivery_partner_id: string | null;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  delivery_fee: number;
  total: number;
  coupon_id: string | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  delivery_otp: string | null;
  delivery_notes: string | null;
  customer_lat: number | null;
  customer_lng: number | null;
  delivery_address: Record<string, unknown> | null;
  estimated_delivery_time: string | null;
  placed_at: string;
  accepted_at: string | null;
  delivered_at: string | null;
  payment_confirmed_at: string | null;
  payment_confirmed_by: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderItem = {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  item_price: number;
  quantity: number;
  subtotal: number;
}

export type Payment = {
  id: string;
  order_id: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  created_at: string;
}

export type Review = {
  id: string;
  order_id: string | null;
  customer_id: string;
  menu_item_id: string | null;
  rating: number;
  comment: string | null;
  is_approved: boolean;
  created_at: string;
}

export type Notification = {
  id: string;
  user_id: string;
  order_id: string | null;
  type: NotificationType;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

export type DeliveryTracking = {
  id: string;
  order_id: string;
  delivery_partner_id: string;
  latitude: number;
  longitude: number;
  recorded_at: string;
}

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
}

export type BusinessSettings = {
  id: number;
  upi_id: string | null;
  upi_name: string | null;
  status: BusinessStatus;
  is_accepting_orders: boolean;
  min_order_amount: number | null;
  delivery_fee: number | null;
  delivery_radius_km: number | null;
  /** Rupees per km beyond delivery_radius_km. 0 = refuse orders outside it. */
  extra_km_fee: number | null;
  /** Hard delivery limit in km. null = no limit. */
  max_delivery_km: number | null;
  kitchen_lat: number | null;
  kitchen_lng: number | null;
  kitchen_address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  fssai_license: string | null;
  open_time: string | null;
  close_time: string | null;
  updated_at: string;
}

/**
 * Table helper: adds the `Relationships` field Supabase's type system expects.
 * Insert/Update default to a partial of the Row with the given required keys.
 */
type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

/** Database shape matching Supabase's GenericSchema so `.from(...)` is fully typed. */
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, "id">;
      delivery_partners: Table<DeliveryPartner, "id">;
      addresses: Table<Address, "user_id">;
      categories: Table<Category, "name" | "slug">;
      menu_items: Table<MenuItem, "name" | "price">;
      cart_items: Table<CartItem, "user_id" | "menu_item_id">;
      coupons: Table<Coupon, "code" | "coupon_type" | "discount_value">;
      orders: Table<Order, "customer_id">;
      order_items: Table<OrderItem, "order_id" | "item_name" | "item_price" | "quantity" | "subtotal">;
      payments: Table<Payment, "order_id" | "amount">;
      reviews: Table<Review, "customer_id" | "rating">;
      notifications: Table<Notification, "user_id" | "title">;
      delivery_tracking: Table<DeliveryTracking, "order_id" | "delivery_partner_id" | "latitude" | "longitude">;
      business_settings: Table<BusinessSettings>;
      push_subscriptions: Table<PushSubscriptionRow, "user_id" | "endpoint" | "p256dh" | "auth">;
    };
    Views: { [_ in never]: never };
    Functions: {
      apply_coupon: {
        Args: { p_code: string; p_subtotal: number };
        Returns: {
          coupon_id: string | null;
          code: string | null;
          discount: number;
          label: string | null;
          reason: string;
          min_required: number | null;
          once_per_customer: boolean;
        }[];
      };
      items_sold_today: {
        Args: { p_item_id: string };
        Returns: number;
      };
      bump_order_counts: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      redeem_coupon: {
        Args: { p_coupon_id: string };
        Returns: undefined;
      };
    };
    Enums: {
      user_role: UserRole;
      order_status: OrderStatus;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      food_type: FoodType;
      business_status: BusinessStatus;
      coupon_type: CouponType;
      vehicle_type: VehicleType;
      rider_status: RiderStatus;
      notification_type: NotificationType;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
