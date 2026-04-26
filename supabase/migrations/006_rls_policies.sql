-- 006_rls_policies.sql
-- Row Level Security for all tables

-- Enable RLS
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_benchmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Public read access for catalog data
CREATE POLICY "Models are viewable by everyone"
  ON models FOR SELECT USING (true);

CREATE POLICY "Benchmarks are viewable by everyone"
  ON benchmarks FOR SELECT USING (true);

CREATE POLICY "Benchmark questions are viewable by everyone"
  ON benchmark_questions FOR SELECT USING (true);

CREATE POLICY "Evaluations are viewable by everyone"
  ON evaluations FOR SELECT USING (true);

CREATE POLICY "Evaluation results are viewable by everyone"
  ON evaluation_results FOR SELECT USING (true);

CREATE POLICY "Spaces are viewable by everyone"
  ON spaces FOR SELECT USING (true);

CREATE POLICY "Space benchmarks are viewable by everyone"
  ON space_benchmarks FOR SELECT USING (true);

-- Profiles: public read, self-write
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
