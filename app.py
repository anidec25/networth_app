import streamlit as st
import pandas as pd
import gspread
from google.oauth2.service_account import Credentials
import plotly.express as px
from datetime import date

# ====================================================
# PAGE CONFIG
# ====================================================
st.set_page_config(
    page_title="Net Worth Tracker",
    page_icon="💰",
    layout="centered",
    initial_sidebar_state="collapsed"
)

# ====================================================
# CONSTANTS
# ====================================================
SHEET_ID = "1Rm8tDtwEx8K2MFxBk7mULo5zky-7oPnv-g6JNE7dLLs"

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# ====================================================
# AUTH
# ====================================================
creds = Credentials.from_service_account_info(
    st.secrets["gcp_service_account"],
    scopes=SCOPES
)
client = gspread.authorize(creds)
sheet = client.open_by_key(SHEET_ID)

# ====================================================
# CSS
# ====================================================
st.markdown("""
<style>
.card {
    background: white;
    padding: 1.25rem;
    border-radius: 16px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.12);
    margin-bottom: 1rem;
}

.card-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    color: #6b7280;
}

.card-value {
    font-size: 1.6rem;
    font-weight: 700;
    color: #111827;
}

.card-sub {
    font-size: 0.8rem;
}
</style>
""", unsafe_allow_html=True)

# ====================================================
# HELPERS
# ====================================================
@st.cache_data(ttl=300)
def load_sheet(tab):
    return pd.DataFrame(sheet.worksheet(tab).get_all_records())

def normalize_month_end(d):
    return pd.to_datetime(d) + pd.offsets.MonthEnd(0)

def clean_date(df):
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    return df.dropna(subset=["date"])

def clean_value(df):
    df["value"] = pd.to_numeric(df["value"], errors="coerce").fillna(0)
    return df

# ====================================================
# LOAD DATA
# ====================================================
asset_categories = load_sheet("asset_categories")
liability_categories = load_sheet("liability_categories")
assets = load_sheet("assets")
liabilities = load_sheet("liabilities")

if not assets.empty:
    assets = clean_value(clean_date(assets))
    assets["month"] = assets["date"].dt.to_period("M").dt.to_timestamp("M")

if not liabilities.empty:
    liabilities = clean_value(clean_date(liabilities))
    liabilities["month"] = liabilities["date"].dt.to_period("M").dt.to_timestamp("M")

show_empty_state = assets.empty and liabilities.empty

# ====================================================
# UI
# ====================================================
st.title("💰 Net Worth Tracker")

tab1, tab2, tab3 = st.tabs([
    "📊 Dashboard",
    "➕ Add Asset",
    "➕ Add Liability"
])

# ====================================================
# DASHBOARD
# ====================================================
with tab1:
    if show_empty_state:
        st.markdown(
            """
            <div style="
                max-width:720px;
                margin:3rem auto;
                background:white;
                padding:2.5rem 2rem;
                border-radius:20px;
                box-shadow:0 10px 30px rgba(0,0,0,0.12);
                text-align:center;
            ">
                <div style="font-size:3rem;">👋</div>
                <h2 style="margin:0.5rem 0;color:#111827;">
                    Welcome to Net Worth Tracker
                </h2>
                <p style="color:#4b5563;font-size:1rem;line-height:1.6;">
                    Start by adding your first asset or liability.<br>
                    This dashboard will track your net worth growth over time.
                </p>
            </div>
            """,
            unsafe_allow_html=True
        )

    else:
        total_assets = assets["value"].sum()
        total_liabilities = liabilities["value"].sum()
        net_worth = total_assets - total_liabilities

        for label, val in [
            ("Total Assets", total_assets),
            ("Total Liabilities", total_liabilities),
            ("Net Worth", net_worth)
        ]:
            st.markdown(f"""
            <div class="card">
                <div class="card-title">{label}</div>
                <div class="card-value">₹{val:,.0f}</div>
            </div>
            """, unsafe_allow_html=True)

        asset_ts = assets.groupby("month")["value"].sum()
        liability_ts = liabilities.groupby("month")["value"].sum()

        networth_ts = asset_ts.subtract(liability_ts, fill_value=0).reset_index(name="net_worth")

        st.plotly_chart(
            px.line(
                networth_ts,
                x="month",
                y="net_worth",
                height=260,
                template="plotly_white"
            ),
            use_container_width=True
        )

# ====================================================
# ADD ASSET
# ====================================================
with tab2:
    st.subheader("➕ Add Asset")

    with st.form("asset_form"):
        asset_date = st.date_input("Date", date.today())
        asset_category = st.selectbox("Asset Category", asset_categories["asset_category"])
        asset_name = st.text_input("Asset Name")
        value = st.number_input("Value (₹)", min_value=0.0)
        notes = st.text_area("Notes")
        submitted = st.form_submit_button("Save Asset")

    if submitted:
        sheet.worksheet("assets").append_row([
            normalize_month_end(asset_date).strftime("%Y-%m-%d"),
            asset_category,
            asset_name,
            float(value),
            notes
        ])
        st.success("Asset added successfully")
        st.cache_data.clear()
        st.rerun()

# ====================================================
# ADD LIABILITY
# ====================================================
with tab3:
    st.subheader("➕ Add Liability")

    with st.form("liability_form"):
        liability_date = st.date_input("Date", date.today())
        liability_category = st.selectbox("Liability Category", liability_categories["liability_category"])
        liability_name = st.text_input("Liability Name")
        value = st.number_input("Amount Owed (₹)", min_value=0.0)
        notes = st.text_area("Notes")
        submitted = st.form_submit_button("Save Liability")

    if submitted:
        sheet.worksheet("liabilities").append_row([
            normalize_month_end(liability_date).strftime("%Y-%m-%d"),
            liability_category,
            liability_name,
            float(value),
            notes
        ])
        st.success("Liability added successfully")
        st.cache_data.clear()
        st.rerun()
