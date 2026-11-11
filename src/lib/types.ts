export type Memo = {
  id: string;
  memo_no: string;
  title: string;
  memo_date: string; // YYYY-MM-DD
  file_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
};

export type Recipient = {
  id: string;
  name: string | null;
  email: string;
};
