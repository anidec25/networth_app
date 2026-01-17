import streamlit as st
import pandas as pd
import gspread
from google.oauth2.service_account import Credentials
import plotly.express as px
from datetime import date

# ====================================================
# PAGE CONFIG (MOBILE FIRST)
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
# CSS (MOBILE FRIENDLY)
# ====================================================
st.markdown("""
<style>
.card {
    background: white;
    padding: 1rem;
    border-radius: 14px;
    box-shadow: 0 3px 10px rgba(0,0,0,0.08);
    margin-bottom: 1rem;
}

.card-title {
    font-size: 0.7rem;
    text-transform: uppercase;
    color: #6b7280;
    margin-bottom: 0.3rem;
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
def load_sheet(tab_name):
    return pd.DataFrame(sheet.worksheet(tab_name).get_all_records())

def normalize_month_end(d):
    return pd.to_datetime(d) + pd.offsets.MonthEnd(0)

def clean_numeric(df, col):
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return df

def clean_date(df, col):
    if col in df.columns:
        df[col] = pd.to_datetime(df[col], errors="coerce")
        df = df.dropna(subset=[col])
    return df

# ====================================================
# LOAD DATA
# ====================================================
asset_categories = load_sheet("asset_categories")
liability_categories = load_sheet("liability_categories")
assets = load_sheet("assets")
liabilities = load_sheet("liabilities")

# ====================================================
# DATA CLEANING
# ====================================================
assets = clean_numeric(clean_date(assets, "date"), "value")
liabilities = clean_numeric(clean_date(liabilities, "date"), "value")

assets["month"] = assets["date"].dt.to_period("M").dt.to_timestamp("M")
liabilities["month"] = liabilities["date"].dt.to_period("M").dt.to_timestamp("M")

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
    if assets.empty and liabilities.empty:
        st.info("No data yet. Add assets or liabilities to begin.")
        st.stop()

    # ------------------------------------------------
    # OVERALL KPIs
    # ------------------------------------------------
    total_assets = assets["value"].sum()
    total_liabilities = liabilities["value"].sum()
    net_worth = total_assets - total_liabilities

    for label, value in [
        ("Total Assets", total_assets),
        ("Total Liabilities", total_liabilities),
        ("Net Worth", net_worth),
    ]:
        st.markdown(f"""
        <div class="card">
            <div class="card-title">{label}</div>
            <div class="card-value">₹{value:,.0f}</div>
        </div>
        """, unsafe_allow_html=True)

    # ------------------------------------------------
    # NET WORTH TREND
    # ------------------------------------------------
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
    # 📈 OVERALL PORTFOLIO MoM (KEEPED)
    # ====================================================
    mom_series = asset_ts.pct_change() * 100
    mom_series = mom_series.dropna()

    latest_mom = mom_series.iloc[-1] if not mom_series.empty else 0
    prev_mom = mom_series.iloc[-2] if len(mom_series) > 1 else 0
    mom_delta = latest_mom - prev_mom

    st.markdown(f"""
    <div class="card">
        <div class="card-title">Assets MoM Growth</div>
        <div class="card-value">{latest_mom:.2f}%</div>
        <div class="card-sub" style="color:{'#16a34a' if mom_delta >= 0 else '#dc2626'};">
            {'▲' if mom_delta >= 0 else '▼'} {abs(mom_delta):.2f}% vs last month
        </div>
    </div>
    """, unsafe_allow_html=True)

    mom_df = mom_series.reset_index(name="growth_pct")

    fig_mom = px.bar(
        mom_df,
        x="month",
        y="growth_pct",
        height=260,
        labels={"growth_pct": "MoM Growth (%)"},
        template="plotly_white"
    )

    fig_mom.update_traces(
        marker_color=[
            "#16a34a" if v >= 0 else "#dc2626"
            for v in mom_df["growth_pct"]
        ]
    )

    st.plotly_chart(fig_mom, use_container_width=True)

    # ====================================================
    # 📌 ASSET CLASS MoM (NEW)
    # ====================================================
    st.subheader("📌 Asset Class MoM Growth")

    latest_month = assets["month"].max()
    prev_month = latest_month - pd.offsets.MonthEnd(1)

    latest_cls = (
        assets[assets["month"] == latest_month]
        .groupby("asset_category")["value"]
        .sum()
        .reset_index(name="latest_value")
    )

    prev_cls = (
        assets[assets["month"] == prev_month]
        .groupby("asset_category")["value"]
        .sum()
        .reset_index(name="prev_value")
    )

    cls_mom = latest_cls.merge(prev_cls, on="asset_category", how="left")
    cls_mom["prev_value"] = cls_mom["prev_value"].fillna(0)

    cls_mom["mom_pct"] = cls_mom.apply(
        lambda x: ((x["latest_value"] - x["prev_value"]) / x["prev_value"] * 100)
        if x["prev_value"] > 0 else 0,
        axis=1
    )

    for _, row in cls_mom.sort_values("latest_value", ascending=False).iterrows():
        mom = row["mom_pct"]
        color = "#16a34a" if mom >= 0 else "#dc2626"
        arrow = "▲" if mom >= 0 else "▼"

        st.markdown(f"""
        <div class="card">
            <div class="card-title">{row['asset_category']}</div>
            <div class="card-value">₹{row['latest_value']:,.0f}</div>
            <div class="card-sub" style="color:{color};">
                {arrow} {abs(mom):.2f}% MoM
            </div>
        </div>
        """, unsafe_allow_html=True)

    fig_cls = px.bar(
        cls_mom,
        x="asset_category",
        y="mom_pct",
        height=260,
        labels={"mom_pct": "MoM Growth (%)"},
        template="plotly_white"
    )

    fig_cls.update_traces(
        marker_color=[
            "#16a34a" if v >= 0 else "#dc2626"
            for v in cls_mom["mom_pct"]
        ]
    )

    st.plotly_chart(fig_cls, use_container_width=True)

    # ------------------------------------------------
    # ALLOCATION
    # ------------------------------------------------
    with st.expander("📊 Allocation Breakdown"):
        st.plotly_chart(
            px.pie(
                assets.groupby("asset_category")["value"].sum().reset_index(),
                values="value",
                names="asset_category"
            ),
            use_container_width=True
        )

        st.plotly_chart(
            px.pie(
                liabilities.groupby("liability_category")["value"].sum().reset_index(),
                values="value",
                names="liability_category"
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
        st.success("Asset added")
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
        st.success("Liability added")
        st.cache_data.clear()
        st.rerun()
