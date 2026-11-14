import { Star, Icon } from "./Icons";
export function WorkflowVisual({ kind }: { kind: string }) {
  return (
    <div className={"workflow-visual visual-" + kind}>
      <span className="visual-label">ETALIER / ILLUSTRATIVE WORKSPACE</span>
      {kind === "front-desk" ? (
        <>
          <div className="visual-receipt">
            <h3>
              A good visit.
              <br />
              All accounted for.
            </h3>
            <div>
              <span>Cut & finish</span>
              <strong>€65.00</strong>
            </div>
            <div>
              <span>Courtesy discount</span>
              <strong>−€5.00</strong>
            </div>
            <div>
              <span>Tip</span>
              <strong>€4.00</strong>
            </div>
            <div className="receipt-total">
              <span>Received · card</span>
              <strong>€64.00</strong>
            </div>
            <span className="visual-confirm">
              <Icon name="check" size={16} /> Visit recorded
            </span>
          </div>
          <span className="visual-sticker">
            Next customer?
            <br />
            You’re ready.
          </span>
        </>
      ) : kind === "bookings" ? (
        <>
          <h3>
            A little room
            <br />
            between appointments.
          </h3>
          <div className="visual-calendar">
            {["09:00", "10:00", "11:00", "12:00"].map((t, i) => (
              <div key={t}>
                <time>{t}</time>
                <span className={"calendar-block block-" + i}>
                  {
                    [
                      "Cut & finish · Sofia",
                      "Station reset",
                      "Colour refresh · Lucas",
                      "Consultation · Emma",
                    ][i]
                  }
                  <small>
                    {
                      [
                        "60 minutes",
                        "10-minute buffer",
                        "90 minutes",
                        "30 minutes",
                      ][i]
                    }
                  </small>
                </span>
              </div>
            ))}
          </div>
        </>
      ) : kind === "customer-records" ? (
        <>
          <div className="visual-profile">
            <span className="profile-monogram">CW</span>
            <div>
              <small>CUSTOMER RECORD</small>
              <h3>Clara Weber</h3>
              <span>Prefers a quiet appointment.</span>
            </div>
          </div>
          <div className="visual-answer">
            <h4>What would you like to change?</h4>
            <p>
              Keep the length, soften the shape, and make it easier to style
              before work.
            </p>
            <span className="visual-confirm">
              <Icon name="check" size={16} /> Ready for the consultation
            </span>
          </div>
        </>
      ) : (
        <>
          <h3>
            The people.
            <br />
            Then the numbers.
          </h3>
          <div className="visual-team">
            <span className="profile-monogram">SM</span>
            <div>
              <strong>Sofia Müller</strong>
              <small>Senior stylist · Monthly payroll</small>
            </div>
            <span className="draft-tag">Draft</span>
          </div>
          <div className="payroll-demo">
            <div>
              <span>Base salary</span>
              <strong>€3,200.00</strong>
            </div>
            <div>
              <span>Commission</span>
              <strong>€280.00</strong>
            </div>
            <div>
              <span>Approved bonus</span>
              <strong>€100.00</strong>
            </div>
            <div className="receipt-total">
              <span>Before other adjustments</span>
              <strong>€3,580.00</strong>
            </div>
          </div>
          <small className="demo-disclosure">
            Illustrative amounts. Review the calculation before approval.
          </small>
        </>
      )}
      <Star className="visual-star" />
    </div>
  );
}
