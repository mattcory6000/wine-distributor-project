-- ============================================
-- AOC WINES SCHEMA - PHASE 1 
-- Saved for reference only
-- ============================================

-- Organizations (tenants - wine distributors)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pricing formulas per organization
CREATE TABLE pricing_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  formula_type TEXT NOT NULL CHECK (formula_type IN ('wine', 'spirits', 'non_alcoholic')),
  tax_per_liter DECIMAL(10,4) NOT NULL DEFAULT 0,
  tax_fixed DECIMAL(10,4) NOT NULL DEFAULT 0,
  shipping_per_case DECIMAL(10,2) NOT NULL DEFAULT 13,
  margin_divisor DECIMAL(5,4) NOT NULL DEFAULT 0.65,
  srp_multiplier DECIMAL(5,4) NOT NULL DEFAULT 1.47,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, formula_type)
);

-- Suppliers (upstream distributors)
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Column mapping templates per supplier
CREATE TABLE mapping_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  mapping JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(supplier_id)
);

-- Products catalog
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  item_code TEXT,
  producer TEXT NOT NULL,
  product_name TEXT NOT NULL,
  vintage TEXT,
  pack_size INTEGER NOT NULL DEFAULT 12,
  bottle_size_ml INTEGER NOT NULL DEFAULT 750,
  product_type TEXT NOT NULL DEFAULT 'wine',
  fob_case_price DECIMAL(10,2) NOT NULL,
  product_link TEXT,
  country TEXT,
  region TEXT,
  appellation TEXT,
  extra_fields JSONB DEFAULT '{}',
  is_discontinued BOOLEAN DEFAULT false,
  discontinued_at TIMESTAMPTZ,
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_products_supplier ON products(supplier_id);

-- User profiles (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer', 'super_admin')),
  access_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, username)
);

-- Special order items (persistent per customer)
CREATE TABLE special_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  cases INTEGER NOT NULL DEFAULT 0,
  bottles INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Requested',
  notes TEXT,
  admin_notes TEXT,
  has_unseen_update BOOLEAN DEFAULT false,
  submitted BOOLEAN DEFAULT false,
  frontline_price_snapshot DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- Order history
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  items JSONB NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  ideal_delivery_date DATE,
  must_have_by_date DATE,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_orders_org ON orders(organization_id);
CREATE INDEX idx_orders_user ON orders(user_id);

-- Taxonomy reference
CREATE TABLE taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  region TEXT,
  appellation TEXT,
  UNIQUE(organization_id, country, region, appellation)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_formulas ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mapping_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_org_admin()
RETURNS BOOLEAN AS $$
  SELECT role IN ('admin', 'super_admin') FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Organization policies
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  USING (id = get_user_org_id());

-- Product policies
CREATE POLICY "Org users can view products"
  ON products FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "Admins can insert products"
  ON products FOR INSERT
  WITH CHECK (organization_id = get_user_org_id() AND is_org_admin());

CREATE POLICY "Admins can update products"
  ON products FOR UPDATE
  USING (organization_id = get_user_org_id() AND is_org_admin());

CREATE POLICY "Admins can delete products"
  ON products FOR DELETE
  USING (organization_id = get_user_org_id() AND is_org_admin());

-- Special order policies
CREATE POLICY "Users can view own special orders"
  ON special_order_items FOR SELECT
  USING (organization_id = get_user_org_id() AND (user_id = auth.uid() OR is_org_admin()));

CREATE POLICY "Users can insert own special orders"
  ON special_order_items FOR INSERT
  WITH CHECK (organization_id = get_user_org_id() AND user_id = auth.uid());

CREATE POLICY "Users can update own special orders"
  ON special_order_items FOR UPDATE
  USING (organization_id = get_user_org_id() AND (user_id = auth.uid() OR is_org_admin()));

CREATE POLICY "Users can delete own special orders"
  ON special_order_items FOR DELETE
  USING (organization_id = get_user_org_id() AND (user_id = auth.uid() OR is_org_admin()));

-- Order policies
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (organization_id = get_user_org_id() AND (user_id = auth.uid() OR is_org_admin()));

CREATE POLICY "Users can insert own orders"
  ON orders FOR INSERT
  WITH CHECK (organization_id = get_user_org_id() AND user_id = auth.uid());

-- User profile policies
CREATE POLICY "Users can view profiles in org"
  ON user_profiles FOR SELECT
  USING (organization_id = get_user_org_id() AND (id = auth.uid() OR is_org_admin()));

-- Pricing formula policies
CREATE POLICY "Org users can view formulas"
  ON pricing_formulas FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "Admins can manage formulas"
  ON pricing_formulas FOR ALL
  USING (organization_id = get_user_org_id() AND is_org_admin());

-- Supplier policies
CREATE POLICY "Org users can view suppliers"
  ON suppliers FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "Admins can manage suppliers"
  ON suppliers FOR ALL
  USING (organization_id = get_user_org_id() AND is_org_admin());

-- Mapping template policies
CREATE POLICY "Admins can manage mapping templates"
  ON mapping_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM suppliers s 
      WHERE s.id = mapping_templates.supplier_id 
      AND s.organization_id = get_user_org_id()
    ) AND is_org_admin()
  );

-- Taxonomy policies
CREATE POLICY "Org users can view taxonomy"
  ON taxonomy FOR SELECT
  USING (organization_id = get_user_org_id());

CREATE POLICY "Admins can manage taxonomy"
  ON taxonomy FOR ALL
  USING (organization_id = get_user_org_id() AND is_org_admin());

-- ============================================
-- SEED DATA: AOC Wines Organization
-- ============================================

INSERT INTO organizations (id, name, slug) 
VALUES ('a0000000-0000-0000-0000-000000000001', 'AOC Wines', 'aoc-wines');

INSERT INTO pricing_formulas (organization_id, formula_type, tax_per_liter, tax_fixed, shipping_per_case, margin_divisor, srp_multiplier)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'wine', 0.32, 0.15, 13, 0.65, 1.47),
  ('a0000000-0000-0000-0000-000000000001', 'spirits', 1.17, 0.15, 13, 0.65, 1.47),
  ('a0000000-0000-0000-0000-000000000001', 'non_alcoholic', 0, 0, 13, 0.65, 1.47);