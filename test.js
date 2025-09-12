
import axios from 'axios';

let userAccessToken = 'AQXvOScVaXT2RhCBJSsqOFbRyPZgBKL7fMxLv-PoXN0QyrLabwSOzFZyZwi7TPnauXRro-SJ_qfz2-Y1DsnK5_xt3Prgx7HpE-yByAK2pVDuWHom2np3RMw0bVLYoVghPgrau51BEYyHO6v8cMMe4ADKgqBc9Bg-0uVqnpRNMKhenNX5A2OXx05zKXaHPaAyMCb7Zm2WzIJwCViRFyjKRSsCP0409QPYnC3o3xYBqOTH4oQXc8Sa1VQh0EGzJYC7nQB9rLp8dsoPQVC3xDdLyIGjz_LY586DQrQAdXdFzgVrFFqv3TCF_xU2AUdNK1MacZlTP7rMyepEBXbRYsDHJeDK1lA3JA'  



let postData = {
  "author": "urn:li:organization:108456956",
"commentary": "✨ Exciting News! ✨\n\nWe’re thrilled to announce our **New Project Launch** 🚀\n\nHere’s what you’ll see in the carousel below:\n\n🔹 Image 1: Project Overview\n🔹 Image 2: Key Benefits\n\n📌 Why this matters:\n- Innovative solution for modern challenges ⚡\n- Built with scalability and security in mind 🔒\n- Designed to deliver real-world impact 🌍\n\n👉 Swipe through the images to explore the highlights!\n\n#Innovation #Launch #Teamwork #FutureReady",  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED",
    "targetEntities": [],
    "thirdPartyDistributionChannels": []
  },
  "content": {
    "multiImage": {
      "images": [
        { "id": "urn:li:image:D5610AQF1CA-VBcnfYg" },
        { "id": "urn:li:image:D5610AQHJIADSGY_5YA" }
      ]
    }
  },
  "lifecycleState": "PUBLISHED",
  "isReshareDisabledByAuthor": false
}




const upload = async () => {
  try {
    const postResponse = await axios.post(
      "https://api.linkedin.com/rest/posts",
      postData,
      {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
          "LinkedIn-Version": "202508", // 👈 required
          "X-Restli-Protocol-Version": "2.0.0",
          "Content-Type": "application/json"
        }
      }
    );
    console.log("✅ Post successfully published:", postResponse.data);
  } catch (error) {
    console.error(
      "❌ Error posting to LinkedIn:",
      error.response?.data || error
    );
  }
};

// upload();

upload();




































//  {"access_token":"AQVbQx62ItzUjyEpJ_Dr0qC60LWDflyVcy1wrgq0bqrj9_a4E4OnxU5NjbVvQdJieodYZtLrR_lP7--r2lG0aC3NkrZqXBrtpMbJeS5r6Ju2578KNbUtzPKPRHxX-Kohz3ZcB4JLxy4b3WwTE2q0nY3pe7yBLiSo0XnZKKb5PZyU3-X7UH917j_2w256a_rG71XT_ly652xSHNn2dB5j6QiGD7gWO5jSbGQB6mMtcHtTlxk_Ex9W37A8eJ11w1Mb7R2QffJvS7BzR-hcLZtnDX_PF-T7z2gjXeshw-SrhVLjOelG2VF5Fh5K1P_KIQeB9jzF9UeuFCasbS--mKYWHRB40JaZ8g","expires_in":5183999,"scope":"email,openid,profile,w_member_social","token_type":"Bearer","id_token":"eyJ6aXAiOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImQ5Mjk2NjhhLWJhYjEtNGM2OS05NTk4LTQzNzMxNDk3MjNmZiIsImFsZyI6IlJTMjU2In0.eyJpc3MiOiJodHRwczovL3d3dy5saW5rZWRpbi5jb20vb2F1dGgiLCJhdWQiOiI4NnFnb2lqdjd5b3YwaiIsImlhdCI6MTc1Njg3NjM3MSwiZXhwIjoxNzU2ODc5OTcxLCJzdWIiOiItRHduUXlDdHRTIiwibmFtZSI6Ik1laHJlZW4gU2hlaWtoIiwiZ2l2ZW5fbmFtZSI6Ik1laHJlZW4iLCJmYW1pbHlfbmFtZSI6IlNoZWlraCIsInBpY3R1cmUiOiJodHRwczovL21lZGlhLmxpY2RuLmNvbS9kbXMvaW1hZ2UvdjIvRDREMDNBUUdrbHJ4V0JHNFJSZy9wcm9maWxlLWRpc3BsYXlwaG90by1zaHJpbmtfMTAwXzEwMC9wcm9maWxlLWRpc3BsYXlwaG90by1zaHJpbmtfMTAwXzEwMC8wLzE2OTA0NzM5OTAxNTE_ZT0xNzU5OTY4MDAwJnY9YmV0YSZ0PXNEXzVHTEI4ZDNlaWtZVVpDdXd4Z0hCZG1UNU1vOXdQYlhfeEIxZ3ZyZlkiLCJlbWFpbCI6Im1laHJlZW4uc2hlaWtoNDc0N0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6InRydWUiLCJsb2NhbGUiOiJlbl9VUyJ9.IgEic4JVItSyHyhCJg_paDwVEidKlYRkvIZwb7hr0W4MpUj2PH5_zNctQ-NVR3851Ei2dxCv46FygY99ZFAyQQA-Iuyxt-5q9FBscrYJtWViRV0YEX1tAxWwO0oVYMoTdlY9dAexq0vvEuRtq0pR1jH9_IJ5xlOM5PUBafwOWl0TbEFZ1VRx1oY1T3P7FD-yMHRXp9L7QDWX3GFtMRq6kvWqdM1dellj3VFHnVhec3X9iTXxXO2wLvJh3oKQkzZL_FetYut6FdECj2nm6hgouSpHdWp-yvR9KF_oYwchpiWbE18kH9QmiI_GqGsPD_X7en1HgFqRkghZiVHbv5ATR_hqCTTz1Z7fSV5omVLSVwgdv-IL7KGcb05_vs3x0NZ41sxIT9gf4gC45LZp4tVGyg11-v_otyuUzTrTXzaYSPKeiz4-xt-6kiMeFkRQOkQiIa247jJd9N6Y-zRGq7tiHDdfU7_Qam8D5lcdfAjC6aZ3uspmJJUGjqxiNaxjmRj56uf9SBT2aFLGt9MCahLj_BpAmnuCpLy6UPEwCxh1rV2uwmOHUEwrRThRu8_F02jKwLK3xnbV7xljnVbxxOcKfq8IeJAz74siWE30m-XjFa1Zh9sVIv4I3Ngd9Kl-UskvHSrXwysP91WgBJcNL88cyW4OTj20_mE_dhqi5fyNRkc"}           

            